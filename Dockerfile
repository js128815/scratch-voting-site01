FROM ruby:3.2-alpine

WORKDIR /app

COPY . .

RUN mkdir -p /app/data/uploads

ENV PORT=4567
ENV HOST=0.0.0.0

EXPOSE 4567

CMD ["ruby", "server.rb"]
