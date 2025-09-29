#!/bin/bash

echo "🤖 Ollama Setup für Pixelcoda Search"
echo "====================================="

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "📦 Ollama wird installiert..."
    
    # Install Ollama based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -fsSL https://ollama.ai/install.sh | sh
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://ollama.ai/install.sh | sh
    else
        echo "❌ Unsupported OS. Bitte installiere Ollama manuell von: https://ollama.ai"
        exit 1
    fi
fi

echo "✅ Ollama ist installiert"

# Start Ollama service
echo "🚀 Starte Ollama Service..."
ollama serve &
OLLAMA_PID=$!
sleep 5

# Pull required models
echo "📥 Lade KI-Modelle herunter..."

# Chat model (smaller, faster)
echo "  → Lade llama3.2 (Chat-Modell)..."
ollama pull llama3.2

# Embedding model for vector search
echo "  → Lade nomic-embed-text (Embedding-Modell)..."
ollama pull nomic-embed-text

# Alternative: Larger, more capable model (optional)
# echo "  → Lade llama3.1:8b (Größeres Modell)..."
# ollama pull llama3.1:8b

echo ""
echo "✅ Ollama Setup abgeschlossen!"
echo ""
echo "📝 Füge diese Zeilen zu deiner .env hinzu:"
echo "----------------------------------------"
echo "# Ollama Configuration (Local AI)"
echo "OLLAMA_BASE_URL=http://localhost:11434"
echo "OLLAMA_MODEL=llama3.2"
echo "OLLAMA_EMBEDDING_MODEL=nomic-embed-text"
echo "LLM_PROVIDER=ollama"
echo "----------------------------------------"
echo ""
echo "🔧 Ollama läuft auf: http://localhost:11434"
echo "📊 Verfügbare Modelle anzeigen: ollama list"
echo "🛑 Ollama stoppen: killall ollama"
echo ""

# Keep Ollama running
echo "Drücke CTRL+C um Ollama zu beenden..."
wait $OLLAMA_PID
