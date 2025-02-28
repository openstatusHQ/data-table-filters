build:
	docker build -t access-log-ui .

run:
	docker run -p 3000:3000 \
		-e USE_MOCK_DATA=false \
		-e LOG_FILE_PATH=/app/data/example/traefik-access-json.log \
		-v $(PWD)/data:/app/data \
		access-log-ui