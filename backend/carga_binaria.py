from fastapi import HTTPException, Request


async def leer_con_limite(request: Request, limite: int) -> bytes:
    contenido = bytearray()
    async for parte in request.stream():
        if len(contenido) + len(parte) > limite:
            raise HTTPException(413, "El archivo supera el tamaño permitido")
        contenido.extend(parte)
    if not contenido:
        raise HTTPException(422, "El archivo está vacío")
    return bytes(contenido)
