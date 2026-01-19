"""
Presidio Anonymizer Flask API
Exposes PII anonymization as REST endpoint
"""

from flask import Flask, request, jsonify
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import RecognizerResult, OperatorConfig

app = Flask(__name__)

# Initialize anonymizer engine
anonymizer = AnonymizerEngine()


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "presidio-anonymizer"})


@app.route("/anonymize", methods=["POST"])
def anonymize():
    """
    Anonymize PII in text

    Request body:
    {
        "text": "string to anonymize",
        "analyzer_results": [
            {"entity_type": "PERSON", "start": 0, "end": 10, "score": 0.85}
        ],
        "operators": {
            "PERSON": {"type": "replace", "new_value": "<PERSON>"}
        } (optional)
    }
    """
    try:
        data = request.get_json()

        if not data or "text" not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400

        if "analyzer_results" not in data:
            return jsonify({"error": "Missing 'analyzer_results' in request body"}), 400

        text = data["text"]

        # Convert analyzer results to RecognizerResult objects
        analyzer_results = [
            RecognizerResult(
                entity_type=r["entity_type"],
                start=r["start"],
                end=r["end"],
                score=r.get("score", 1.0)
            )
            for r in data["analyzer_results"]
        ]

        # Parse operators if provided
        operators = None
        if "operators" in data:
            operators = {
                key: OperatorConfig(
                    operator_name=val.get("type", "replace"),
                    params=val
                )
                for key, val in data["operators"].items()
            }

        # Anonymize text
        result = anonymizer.anonymize(
            text=text,
            analyzer_results=analyzer_results,
            operators=operators
        )

        return jsonify({
            "text": result.text,
            "items": [
                {
                    "entity_type": item.entity_type,
                    "start": item.start,
                    "end": item.end,
                    "operator": item.operator
                }
                for item in result.items
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/operators", methods=["GET"])
def operators():
    """Get list of supported anonymization operators"""
    return jsonify([
        "replace",
        "redact",
        "mask",
        "hash",
        "encrypt"
    ])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002)
