"""
Presidio Analyzer Flask API
Exposes PII detection as REST endpoint
"""

from flask import Flask, request, jsonify
from presidio_analyzer import AnalyzerEngine

app = Flask(__name__)

# Initialize analyzer engine (loads NLP models)
analyzer = AnalyzerEngine()


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "presidio-analyzer"})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze text for PII entities

    Request body:
    {
        "text": "string to analyze",
        "language": "en",
        "entities": ["PERSON", "EMAIL_ADDRESS", ...] (optional)
    }
    """
    try:
        data = request.get_json()

        if not data or "text" not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400

        text = data["text"]
        language = data.get("language", "en")
        entities = data.get("entities", None)

        # Analyze text
        results = analyzer.analyze(
            text=text,
            language=language,
            entities=entities
        )

        # Convert results to JSON-serializable format
        response = [
            {
                "entity_type": r.entity_type,
                "start": r.start,
                "end": r.end,
                "score": r.score
            }
            for r in results
        ]

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/supportedentities", methods=["GET"])
def supported_entities():
    """Get list of supported entity types"""
    language = request.args.get("language", "en")
    entities = analyzer.get_supported_entities(language=language)
    return jsonify(entities)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
