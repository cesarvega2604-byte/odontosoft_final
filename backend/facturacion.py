from datetime import datetime, timedelta, timezone
from html import escape
from io import BytesIO

from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
import models
from access import correo_cuenta_paciente
from agenda import ZONA_AGENDA, normalizar


def pago_confirmado(pago):
    return normalizar(pago.estado_pago) in {
        "pagado", "pagada", "confirmado", "confirmada", "completado", "aprobado",
    }


def emitir_factura(db, pago, importes=None):
    if pago.factura is not None:
        return pago.factura
    if not pago_confirmado(pago):
        raise HTTPException(409, "Confirma el pago antes de emitir el comprobante")

    ahora = datetime.now(timezone.utc)
    compra = pago.compra
    if compra is not None:
        id_paciente, cliente, concepto = compra.id_paciente, compra.cliente, compra.concepto
    else:
        paciente = pago.cita.paciente
        id_paciente = paciente.id_paciente
        cliente = f"{paciente.nombre} {paciente.apellido}".strip()
        concepto = ", ".join(sorted(t.nombre for t in pago.cita.tratamientos)) or "Servicio odontológico"

    datos = {
        "fecha_emision": ahora.astimezone(ZONA_AGENDA).date(),
        "subtotal": pago.monto, "impuesto": None, "total": pago.monto,
    }
    if importes is not None:
        datos.update({key: value for key, value in importes.items() if value is not None})
        if datos["total"] != pago.monto:
            raise HTTPException(422, "El total debe coincidir con el pago confirmado")
    factura = models.Factura(
        pago=pago, id_paciente=id_paciente, cliente=cliente, concepto=concepto,
        emitida_en=ahora, metodo_pago=pago.metodo_pago, fecha_pago=pago.fecha_pago,
        solicitada_en=compra.solicitada_en if compra is not None else None, **datos,
    )
    factura.envio = models.CorreoProgramado(
        tipo="factura",
        programado_para=ahora, vence=ahora + timedelta(days=30),
    )
    db.add(factura)
    db.flush()
    return factura


def destinatario_factura(db, factura):
    return correo_cuenta_paciente(db, factura.id_paciente)


def formato_fecha(instante):
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=timezone.utc)
    return instante.astimezone(ZONA_AGENDA).strftime("%d/%m/%Y %H:%M (Colombia)")


def factura_pdf(factura):
    archivo = BytesIO()
    estilos = getSampleStyleSheet()
    estilos["Title"].textColor = colors.HexColor("#07506b")
    campos = [
        ("Paciente", factura.cliente or "Sin dato registrado"),
        ("Servicio", factura.concepto or "Servicio odontológico"),
        ("Emisión", formato_fecha(factura.emitida_en) if factura.emitida_en else factura.fecha_emision.strftime("%d/%m/%Y")),
    ]
    if factura.solicitada_en:
        campos.append(("Solicitud de compra", formato_fecha(factura.solicitada_en)))
    if factura.fecha_pago:
        campos.append(("Fecha de pago", factura.fecha_pago.strftime("%d/%m/%Y")))
    if factura.metodo_pago:
        campos.append(("Medio de pago", factura.metodo_pago))
    for etiqueta, importe in (("Subtotal", factura.subtotal), ("Impuesto registrado", factura.impuesto), ("Total", factura.total)):
        if importe is not None:
            formateado = f"{importe:,.2f}".translate(str.maketrans(",.", ".,"))
            campos.append((etiqueta, f"COP {formateado}"))

    contenido = [
        Paragraph("OdontoSoft", estilos["Title"]),
        Paragraph(f"Comprobante interno de servicio · {factura.numero}", estilos["Heading2"]),
        Spacer(1, 5 * mm),
    ]
    contenido.extend(Paragraph(f"<b>{etiqueta}</b> · {escape(valor)}", estilos["BodyText"]) for etiqueta, valor in campos)
    contenido.extend([
        Spacer(1, 5 * mm),
        Paragraph("Documento de uso interno. Sin validación electrónica de la DIAN.", estilos["Italic"]),
    ])
    SimpleDocTemplate(archivo, title=f"OdontoSoft {factura.numero}", author="OdontoSoft").build(contenido)
    return archivo.getvalue()
