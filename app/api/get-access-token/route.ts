import { NextResponse } from 'next/server';

// Questa funzione gestisce la richiesta dal Totem
export async function POST(req: Request) {
  try {
    // 1. Leggiamo cosa ha detto l'utente
    const body = await req.json();
    const userMessage = body.prompt || body.messages?.[body.messages.length - 1]?.content;

    if (!userMessage) {
      return NextResponse.json({ error: "Nessun messaggio ricevuto" }, { status: 400 });
    }

    // 2. Recuperiamo le chiavi da Vercel
    const apiKey = process.env.VOICEFLOW_API_KEY;
    // Usiamo un ID fisso per il totem o quello passato dalla richiesta
    const userID = process.env.VOICEFLOW_USER_ID || 'user_totem_1'; 

    if (!apiKey) {
      return NextResponse.json({ error: "Manca la API Key di Voiceflow su Vercel" }, { status: 500 });
    }

    // 3. Inviamo il messaggio a Voiceflow (Il "Cervello")
    const vfResponse = await fetch(`https://general-runtime.voiceflow.com/state/user/${userID}/interact`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'versionID': 'production' // Usa 'production' o togli questa riga per usare l'ultima versione
      },
      body: JSON.stringify({
        action: {
          type: 'text',
          payload: userMessage
        }
      })
    });

    if (!vfResponse.ok) {
      const errorText = await vfResponse.text();
      console.error("Errore Voiceflow:", errorText);
      return NextResponse.json({ error: "Errore comunicazione con Voiceflow" }, { status: 500 });
    }

    // 4. Leggiamo la risposta di Voiceflow (che è composta da "tracce")
    const traces = await vfResponse.json();
    
    let botReply = "";

    // Voiceflow può restituire testo, immagini o pulsanti. Noi prendiamo il testo.
    for (const trace of traces) {
      if (trace.type === 'text') {
        botReply += trace.payload.message + " ";
      }
      // Se volessi gestire le immagini, dovresti farlo qui
      if (trace.type === 'visual') {
         // Logica per immagini (avanzata)
      }
    }

    // Se Voiceflow non ha risposto con testo (es. solo logica interna)
    if (!botReply.trim()) {
      botReply = "Mi dispiace, sto elaborando la richiesta ma non ho una risposta vocale.";
    }

    // 5. Restituiamo la risposta al Totem (che la farà dire all'Avatar)
    // La demo di HeyGen si aspetta spesso un formato semplice o uno stream.
    // Qui restituiamo un testo semplice che il frontend dovrà leggere.
    return new NextResponse(botReply);

  } catch (error) {
    console.error("Errore nel server:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
