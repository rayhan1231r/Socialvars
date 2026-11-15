import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { Avatar } from './Avatar';

export function CallOverlay() {
  const {
    activeCall,
    localStream,
    remoteStream,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleCallMute,
    toggleCallCamera,
  } = useSocialVerse();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  if (!activeCall) return null;

  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeCall.mode} call with ${activeCall.peerName}`}
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-md h-[78vh] max-h-[680px] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-white/15 shadow-2xl flex flex-col justify-between p-6 text-white">
        {activeCall.mode === 'video' && remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {activeCall.mode === 'video' && localStream && !activeCall.cameraOff && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute top-5 right-5 w-28 h-40 rounded-2xl object-cover border border-white/25 shadow-lg z-20"
          />
        )}

        <div className="relative z-10 text-center space-y-1 pt-4">
          <p className="text-xs uppercase tracking-widest text-sky-400 font-semibold">
            {activeCall.mode === 'video' ? 'Video Call' : 'Voice Call'}
          </p>
          <p className="text-xs text-slate-300 font-mono-num">
            {activeCall.status === 'ringing'
              ? activeCall.direction === 'incoming'
                ? 'Incoming call...'
                : 'Ringing...'
              : `${mins}:${secs}`}
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center gap-3 my-auto">
          <Avatar src={activeCall.peerAvatar} name={activeCall.peerName} size="xl" online />
          <h2 className="text-2xl font-bold tracking-tight">{activeCall.peerName}</h2>
        </div>

        <div className="relative z-10 flex items-center justify-center gap-4 pb-2">
          {activeCall.direction === 'incoming' && activeCall.status === 'ringing' ? (
            <>
              <button
                type="button"
                aria-label="Decline call"
                onClick={declineIncomingCall}
                className="min-h-[56px] min-w-[56px] rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                type="button"
                aria-label="Accept call"
                onClick={acceptIncomingCall}
                className="min-h-[56px] min-w-[56px] rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg"
              >
                <Phone className="w-6 h-6" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={activeCall.muted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={toggleCallMute}
                className={`min-h-[52px] min-w-[52px] rounded-full flex items-center justify-center transition-colors ${
                  activeCall.muted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {activeCall.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {activeCall.mode === 'video' && (
                <button
                  type="button"
                  aria-label={activeCall.cameraOff ? 'Turn camera on' : 'Turn camera off'}
                  onClick={toggleCallCamera}
                  className={`min-h-[52px] min-w-[52px] rounded-full flex items-center justify-center transition-colors ${
                    activeCall.cameraOff
                      ? 'bg-white text-slate-900'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {activeCall.cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              )}

              <button
                type="button"
                aria-label="End call"
                onClick={endCall}
                className="min-h-[56px] min-w-[56px] rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
