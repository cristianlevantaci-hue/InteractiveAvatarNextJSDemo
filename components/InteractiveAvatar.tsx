import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  TaskType, // Importante per far parlare l'avatar
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

// --- CONFIGURAZIONE INIZIALE ---
const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.High,
  avatarName: "19deca1e52b6457d82412bd5fd5216c3", // IL TUO ID
  knowledgeId: undefined, 
  voice: {
    rate: 1.0, 
    emotion: VoiceEmotion.FRIENDLY, 
  },
  language: "it", 
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream, avatar } =
    useStreamingAvatarSession();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const [isTalking, setIsTalking] = useState(false);

  // --- RECUPERO TOKEN ---
  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" });
      return await response.text();
    } catch (error) {
      console.error("Error fetching token:", error);
      throw error;
    }
  }

  // --- AVVIO SESSIONE ---
  const startSessionV2 = useMemoizedFn(async () => {
    try {
      const newToken = await fetchAccessToken();
      // Inizializza l'avatar
      const newAvatar = initAvatar(newToken); 

      // --- EVENTI ---
      
      // 1. QUANDO L'UTENTE FINISCE DI PARLARE -> Manda a Voiceflow
      newAvatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        const userText = event.detail.message;
        console.log(">>>>> Utente ha detto:", userText);

        if (!userText) return;

        try {
          // Chiama il nostro server (route.ts) che parla con Voiceflow
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userText })
          });
          
          const botReply = await response.text();
          console.log(">>>>> Voiceflow risponde:", botReply);

          // Fai parlare l'avatar con la risposta
          if (botReply) {
             await newAvatar.speak({ 
                text: botReply, 
                task_type: TaskType.REPEAT 
             });
          }
        } catch (e) {
          console.error("Errore comunicazione Voiceflow:", e);
        }
      });

      // 2. Eventi di stato (opzionali per debug)
      newAvatar.on(StreamingEvents.AVATAR_START_TALKING, () => setIsTalking(true));
      newAvatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsTalking(false));
      
      // --- START ---
      // Avvia il video dell'avatar
      await startAvatar({
          ...config,
          avatarName: "19deca1e52b6457d82412bd5fd5216c3", // Forza ID
      });

      // Avvia il microfono (SENZA logica OpenAI, solo ascolto)
      await newAvatar.startVoiceChat({ useSilencePrompt: false });

    } catch (error) {
      console.error("Error starting session:", error);
    }
  });

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <div className="p-10 text-white">Pronto per iniziare</div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <Button onClick={startSessionV2}>
              Avvia Totem Villaggio
            </Button>
          ) : (
             <div className="text-white">
                {isTalking ? "Sto parlando..." : "Ti ascolto (Parla ora)"}
                <br/>
                <Button onClick={() => stopAvatar()} className="bg-red-500 mt-2">Termina</Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
