import base64
from decimal import Decimal
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from access import admin_user
from database import get_db
from models import Producto

router = APIRouter(prefix="/productos", tags=["Productos"])
MAX_IMAGE_BYTES = 4 * 1024 * 1024


class ProductoIn(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    precio: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    imagen: str | None = Field(default=None, max_length=4 * ((MAX_IMAGE_BYTES + 2) // 3))
    quitar_imagen: bool = False


def imagen_normalizada(entrada):
    try:
        datos = base64.b64decode(entrada, validate=True)
        if len(datos) > MAX_IMAGE_BYTES:
            raise ValueError()
        with Image.open(BytesIO(datos), formats=("JPEG", "PNG", "WEBP")) as imagen:
            if imagen.width * imagen.height > 16_000_000:
                raise ValueError()
            copia = ImageOps.exif_transpose(imagen)
            copia.thumbnail((1000, 1000))
            salida = BytesIO()
            copia.convert("RGB").save(salida, format="JPEG", quality=86, optimize=True)
            return salida.getvalue()
    except (OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, "Sube una imagen JPG, PNG o WebP válida de hasta 4 MB.") from None


def buscar(db, id_producto):
    producto = db.get(Producto, id_producto)
    if producto is None:
        raise HTTPException(404, "Producto no encontrado.")
    return producto


def representar(producto, tiene_imagen):
    return {
        "id_producto": producto.id_producto, "nombre": producto.nombre, "descripcion": producto.descripcion,
        "precio": str(producto.precio), "tiene_imagen": tiene_imagen,
    }


@router.get("")
def listar(db: Session = Depends(get_db)):
    filas = db.query(
        Producto.id_producto, Producto.nombre, Producto.descripcion, Producto.precio,
        Producto.imagen.is_not(None).label("tiene_imagen"),
    ).order_by(Producto.id_producto.desc()).all()
    return [representar(fila, fila.tiene_imagen) for fila in filas]


@router.get("/{id_producto}/imagen")
def ver_imagen(id_producto: int, db: Session = Depends(get_db)):
    imagen = buscar(db, id_producto).imagen
    if imagen is None:
        raise HTTPException(404, "El producto no tiene imagen.")
    return Response(imagen, media_type="image/jpeg", headers={"Cache-Control": "no-cache"})


def guardar(db, producto, datos):
    imagen = imagen_normalizada(datos.imagen) if datos.imagen is not None else None
    for campo in ("nombre", "descripcion", "precio"):
        setattr(producto, campo, getattr(datos, campo))
    if imagen is not None or datos.quitar_imagen:
        producto.imagen = imagen
    db.add(producto)
    db.commit()
    return representar(producto, producto.imagen is not None)


@router.post("", status_code=201, dependencies=[Depends(admin_user)])
def crear(datos: ProductoIn, db: Session = Depends(get_db)):
    return guardar(db, Producto(), datos)


@router.put("/{id_producto}", dependencies=[Depends(admin_user)])
def editar(id_producto: int, datos: ProductoIn, db: Session = Depends(get_db)):
    return guardar(db, buscar(db, id_producto), datos)


@router.delete("/{id_producto}", status_code=204, dependencies=[Depends(admin_user)])
def eliminar(id_producto: int, db: Session = Depends(get_db)):
    db.delete(buscar(db, id_producto))
    db.commit()
