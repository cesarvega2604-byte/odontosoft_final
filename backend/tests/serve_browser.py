"""API de prueba HTTPS para el recorrido del navegador con PostgreSQL desechable."""

import argparse
import ipaddress
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import uvicorn
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient


def certificate(directory):
    key_path, cert_path = directory / "key.pem", directory / "cert.pem"
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(x509.NameOID.COMMON_NAME, "OdontoSoft local test")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(hours=6))
        .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.IPv4Address("127.0.0.1"))]), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .sign(key, hashes.SHA256())
    )
    with key_path.open("xb") as output:
        output.write(key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption(),
        ))
    with cert_path.open("xb") as output:
        output.write(cert.public_bytes(serialization.Encoding.PEM))
    return key_path, cert_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Carpeta temporal vacía dentro de la cual se escribe el certificado de prueba")
    args = parser.parse_args()
    if not os.environ.get("ODONTO_TEST_DB_URL", "").startswith("postgresql"):
        parser.error("Configura una base PostgreSQL desechable en ODONTO_TEST_DB_URL")
    os.environ["ODONTO_ENV"] = "production"
    os.environ["ODONTO_WEB_ORIGINS"] = "https://127.0.0.1:5176"

    from test_access import AccessTests, app

    with TestClient(app, base_url="http://127.0.0.1:56484") as client:
        if client.get("/health", headers={"X-Forwarded-Proto": "https"}).status_code != 400:
            raise RuntimeError("El modo producción aceptó HTTP")
    AccessTests.setUpClass()
    key, cert = certificate(args.directory)
    uvicorn.run(
        app, host="127.0.0.1", port=56484, lifespan="off", proxy_headers=False,
        ssl_keyfile=str(key), ssl_certfile=str(cert), access_log=False,
    )


if __name__ == "__main__":
    main()
