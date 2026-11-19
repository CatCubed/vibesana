OVERRIDE := $(wildcard docker-compose.override.yml)
PROD := docker compose -f docker-compose.yml $(if $(OVERRIDE),-f $(OVERRIDE))
DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml $(if $(OVERRIDE),-f $(OVERRIDE))

.PHONY: prod dev down logs

prod: ## Build the app and serve it with nginx
	$(PROD) up -d --build --force-recreate

dev: ## Run the Vite dev server with hot reload
	$(DEV) up -d --force-recreate

down:
	$(PROD) down

logs:
	$(PROD) logs -f
