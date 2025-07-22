# Makefile for building and pushing Docker image with auto-incrementing tag

# Variables
IMAGE_NAME = ghcr.io/qntum-dev/rflect
CONFIG_FILE = infra-config.json

# Initialize TAG variable only once
ifeq ($(origin TAG), undefined)
  TAG := $(shell \
    if [ -f .tag ]; then \
      TAG=$$(cat .tag); \
      NEXT_TAG=$$((TAG + 1)); \
      echo $$NEXT_TAG > .tag; \
      echo $$NEXT_TAG; \
    else \
      echo "1" > .tag; \
      echo "1"; \
    fi \
  )
endif

.PHONY: all
all: build push

.PHONY: build
build:
	@echo "🚀 Building image with Encore..."
	@encore build docker --config $(CONFIG_FILE) $(IMAGE_NAME):$(TAG)
	@echo "🏷️ Also tagging as $(IMAGE_NAME):latest"
	@docker tag $(IMAGE_NAME):$(TAG) $(IMAGE_NAME):latest

.PHONY: push
push:
	@echo "📦 Pushing images: $(IMAGE_NAME):$(TAG) and $(IMAGE_NAME):latest"
	@docker push $(IMAGE_NAME):$(TAG) 2>&1 | grep -E "(digest:|error:|unauthorized:|denied:)" || true
	@docker push $(IMAGE_NAME):latest 2>&1 | grep -E "(digest:|error:|unauthorized:|denied:)" || true
	@echo "✅ Images pushed: $(IMAGE_NAME):$(TAG) and $(IMAGE_NAME):latest"

.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts (if any)"
	# Optional clean-up

.PHONY: help
help:
	@echo "Usage:"
	@echo "  make build               Build Docker image with auto-incremented tag and latest tag"
	@echo "  make push                Push Docker image with auto-incremented tag and latest tag"
	@echo "  make all                 Build and push Docker image"
	@echo "  make clean               Clean up build artifacts"
	@echo ""
	@echo "Optional: make TAG=your_tag to override auto-increment"