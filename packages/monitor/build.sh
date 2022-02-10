# if this errors out, run this: docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 --push -t gcr.io/nomad-xyz/nomad-monitor:$1 .