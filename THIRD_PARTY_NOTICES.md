# Componentes de terceros

| Componente | Uso | Licencia |
| --- | --- | --- |
| [Anny](https://github.com/naver/anny) 0.3.1, © 2025 NAVER Corp. | Modelo paramétrico del cuerpo | Apache 2.0 |
| Datos de MakeHuman / MPFB2 incluidos en Anny | Formas del cuerpo («targets») | CC0 1.0 |
| [clad-body](https://github.com/datar-psa/clad-body) 0.6.1, Arkadiusz Kraus | Medidas ISO 8559-1 sobre el maniquí | Apache 2.0 |
| PyTorch, NumPy, SciPy, trimesh, FastAPI, Pydantic, Uvicorn | Cálculo y servidor | BSD / MIT |

**No usamos** los datos con licencia no comercial que Anny descarga para
convertir a SMPL-X (`anny2smplx`). Ninguna parte del motor llama a esa
conversión; si algún día hiciera falta, habría que conseguir una licencia
comercial antes.

Al distribuir el motor (por ejemplo, la imagen Docker) se incluyen los
avisos de licencia que traen los propios paquetes.
