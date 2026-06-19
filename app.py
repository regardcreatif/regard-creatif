import os
import gradio as gr
import google.generativeai as genai

# --- CONFIGURATION ---
# Remplacez par votre clé API ou configurez-la en variable d'environnement
# Pour un usage local, vous pouvez faire : export GOOGLE_API_KEY="VOTRE_CLE"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    print("⚠️ Attention : La variable d'environnement GOOGLE_API_KEY n'est pas définie.")

genai.configure(api_key=GOOGLE_API_KEY)

# Configuration du modèle
generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
}

# Instruction système pour définir la personnalité de l'expert
SYSTEM_PROMPT = """
Tu es "Digital Coach AI", un expert chevronné en marketing digital avec 15 ans d'expérience. 
Ton objectif est d'aider les entrepreneurs, les PME et les créateurs à booster leur présence en ligne.

Tes domaines d'expertise incluent :
1. SEO (Référencement naturel) et SEA (Publicité payante).
2. Stratégie de contenu et Médias Sociaux (Instagram, LinkedIn, TikTok, etc.).
3. Email marketing et Automation.
4. Analyse de données (Google Analytics) et optimisation du taux de conversion (CRO).
5. Branding et positionnement de marque.

Ton ton doit être :
- Professionnel mais accessible (pédagogue).
- Orienté vers l'action (donne des conseils concrets et des étapes précises).
- Encourageant et dynamique.

Réponds toujours en français. Si une question est hors sujet (ex: cuisine, physique quantique), 
rappelle poliment que ta spécialité est le marketing digital.
"""

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
    system_instruction=SYSTEM_PROMPT,
)

# --- LOGIQUE DU CHATBOT ---

def respond(message, history):
    """
    Fonction pour gérer les messages et l'historique avec Gemini.
    """
    if not GOOGLE_API_KEY:
        return "Erreur : La clé API Google Gemini n'est pas configurée."

    # Conversion de l'historique Gradio au format Gemini
    chat_history = []
    for user_msg, assistant_msg in history:
        chat_history.append({"role": "user", "parts": [user_msg]})
        chat_history.append({"role": "model", "parts": [assistant_msg]})

    # Démarrage de la session de chat avec historique
    chat_session = model.start_chat(history=chat_history)
    
    try:
        response = chat_session.send_message(message)
        return response.text
    except Exception as e:
        return f"Désolé, une erreur est survenue : {str(e)}"

# --- INTERFACE GRADIO ---

with gr.Blocks(theme=gr.themes.Soft(primary_hue="blue")) as demo:
    gr.Markdown(
        """
        # 🚀 Digital Coach AI
        ### Votre expert en stratégie digitale disponible 24h/24.
        *SEO, Social Media, Ads, Stratégie de contenu... Posez-moi vos questions !*
        """
    )
    
    chatbot = gr.ChatInterface(
        fn=respond,
        examples=[
            ["Comment améliorer mon SEO local pour mon restaurant ?"],
            ["Peux-tu me donner un plan de contenu de 5 jours pour LinkedIn ?"],
            ["Quelle est la différence entre le Pixel Facebook et l'API de conversion ?"],
            ["Comment réduire mon coût par clic (CPC) sur Google Ads ?"]
        ],
        cache_examples=False,
    )

    gr.Markdown(
        """
        ---
        *Propulsé par Google Gemini 1.5 Flash et Gradio.*
        """
    )

if __name__ == "__main__":
    demo.launch()