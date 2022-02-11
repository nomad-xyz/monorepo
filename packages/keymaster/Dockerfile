FROM python:3.9-bullseye
WORKDIR /code

# Allows docker to cache installed dependencies between builds
COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY keymaster.py keymaster.py
COPY __init__.py __init__.py
COPY config.py config.py
COPY utils.py utils.py

RUN adduser --disabled-password --gecos '' unpriv
RUN chown -R unpriv: /code
CMD python3 keymaster.py monitor