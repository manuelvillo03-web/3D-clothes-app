# Imagen del motor para Cloud Run (o cualquier servidor con contenedores).
#
#   docker build -t probador-engine engine/
#   docker run -p 8080:8080 probador-engine
#
# La imagen crea el modelo de cuerpo al construirse: así Anny deja sus datos
# procesados en ANNY_CACHE_DIR y el servidor arranca en segundos en lugar de
# tardar un minuto en la primera petición.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ANNY_CACHE_DIR=/opt/anny-cache \
    PORT=8080

WORKDIR /app

# PyTorch sin CUDA: el motor funciona en CPU y la versión con CUDA ocupa
# varios GB más.
RUN pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.4"

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install . && \
    python -c "from probador.body import BodyModel; BodyModel.get()" && \
    chmod -R a+rX /opt/anny-cache

RUN useradd --create-home --uid 10001 motor
USER motor

EXPOSE 8080
# Un solo proceso: el modelo ocupa memoria y cada proceso cargaría el suyo.
# Las peticiones de ajuste se atienden de una en una (el modelo lleva cerrojo).
CMD ["sh", "-c", "uvicorn probador.api:app --host 0.0.0.0 --port ${PORT} --workers 1 --no-server-header"]
