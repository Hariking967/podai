FROM python:3.11-slim

RUN pip install --no-cache-dir pandas numpy matplotlib seaborn plotly

WORKDIR /work
COPY runner.py /runner.py
COPY helpers.py /helpers.py

ENTRYPOINT ["python", "/runner.py"]
