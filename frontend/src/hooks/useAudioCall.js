import { useEffect, useRef, useState, useCallback  } from 'react';
import socket from '../socket';

const peerConfig = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'turn:freedom.viktorromanchenko.netxi.in:3478',
      username: 'freedom',
      credential: 'FreedomSecret123',
    },
  ],
};

export function useAudioCall(currentUserId) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callUserId, setCallUserId] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const outgoingRingRef = useRef(null);
  const callEndedSoundRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const stopAudio = (audio) => {
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  };

  const playOutgoingRing = () => {
    if (!outgoingRingRef.current) {
      outgoingRingRef.current = new Audio('/sounds/outgoing_ring.mp3');
      outgoingRingRef.current.loop = true;
    }

    outgoingRingRef.current.play().catch(() => {});
  };

  const stopOutgoingRing = () => {
    stopAudio(outgoingRingRef.current);
  };

  const playCallEndedSound = () => {
    stopOutgoingRing();

    if (!callEndedSoundRef.current) {
      callEndedSoundRef.current = new Audio('/sounds/call_ended.mp3');
    }

    stopAudio(callEndedSoundRef.current);
    callEndedSoundRef.current.play().catch(() => {});
  };

  const createPeer = (targetUserId) => {
    const peer = new RTCPeerConnection(peerConfig);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
        if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        }

        if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        }
    };

    peerRef.current = peer;
    return peer;
  };

  const [isCameraOff, setIsCameraOff] = useState(false);
  const [cameraMode, setCameraMode] = useState('user');

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  };

  const switchCamera = async () => {
  if (!isVideoCall || !localStreamRef.current) return;

  try {
    const newMode = cameraMode === 'user' ? 'environment' : 'user';

    const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

    if (oldVideoTrack) {
      oldVideoTrack.stop();
      localStreamRef.current.removeTrack(oldVideoTrack);
    }

    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: {
          exact: newMode,
        },
      },
    });

    const newVideoTrack = newStream.getVideoTracks()[0];

    const sender = peerRef.current
      ?.getSenders()
      ?.find((s) => s.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }

    localStreamRef.current.addTrack(newVideoTrack);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setCameraMode(newMode);
    setIsCameraOff(false);
  } catch (err) {
    console.error('Switch camera exact error:', err);

    try {
      const fallbackMode = cameraMode === 'user' ? 'environment' : 'user';

      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: fallbackMode,
        },
      });

      const fallbackTrack = fallbackStream.getVideoTracks()[0];

      const sender = peerRef.current
        ?.getSenders()
        ?.find((s) => s.track?.kind === 'video');

      if (sender) {
        await sender.replaceTrack(fallbackTrack);
      }

      const oldTrack = localStreamRef.current?.getVideoTracks()?.[0];

      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }

      localStreamRef.current.addTrack(fallbackTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setCameraMode(fallbackMode);
      setIsCameraOff(false);
    } catch (fallbackErr) {
      console.error('Switch camera fallback error:', fallbackErr);
    }
  }
};

const getLocalMedia = async (
  withVideo = false,
  facingMode = cameraMode
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: withVideo
      ? {
          facingMode,
        }
      : false,
  });

    localStreamRef.current = stream;
    if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
    return stream;
  };

    const startCall = async (targetUserId, withVideo = false) => {
  if (!targetUserId || !currentUserId) return;

  if (isCalling || isInCall || peerRef.current) {
    console.warn('Call already active');
    return;
  }

  try {
    const stream = await getLocalMedia(withVideo);
    const peer = createPeer(targetUserId);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    setCallUserId(targetUserId);
    setIsCalling(true);
    setIsVideoCall(withVideo);
    setCallStatus('Calling...');
    playOutgoingRing();

    socket.emit('callUser', {
      to: targetUserId,
      from: currentUserId,
      offer,
      withVideo,
    });
  } catch (err) {
    console.error('Start call error:', err);
    playCallEndedSound();
    cleanupCall();
  }
};

  const acceptCall = async () => {
  if (!incomingCall) return;

  try {
    if (ringtoneRef.current) {
      stopAudio(ringtoneRef.current);
    }

    const stream = await getLocalMedia(
      incomingCall.withVideo
    );

    const peer = createPeer(incomingCall.from);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    await peer.setRemoteDescription(
      new RTCSessionDescription(incomingCall.offer)
    );

    await flushPendingCandidates();

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);

    socket.emit('acceptCallOnDevice', {
      from: currentUserId,
    });

    socket.emit('answerCall', {
      to: incomingCall.from,
      answer,
    });

    setCallUserId(incomingCall.from);
    setIncomingCall(null);
    setIsInCall(true);
    setIsVideoCall(Boolean(incomingCall.withVideo));

    setCallStatus('In call');

    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
  } catch (err) {
    console.error('Accept call error:', err);
    playCallEndedSound();
    cleanupCall();
  }
};

const rejectCall = () => {
  if (incomingCall) {
    socket.emit('rejectCall', {
      to: incomingCall.from,
      from: currentUserId,
    });
  }

  stopAudio(ringtoneRef.current);
  playCallEndedSound();

  setIncomingCall(null);
  setCallStatus('');
};

  const endCall = () => {
    if (callUserId) {
      socket.emit('endCall', {
        to: callUserId,
      });
    }

    cleanupCall();
    playCallEndedSound();
    setIsVideoCall(false);
  };

  const toggleMute = () => {
  if (!localStreamRef.current) return;

  const audioTrack =
    localStreamRef.current.getAudioTracks()[0];

  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;

  setIsMuted(!audioTrack.enabled);
};

  const cleanupCall = () => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    stopAudio(ringtoneRef.current);
    stopOutgoingRing();

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        }

        if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        }
    clearInterval(timerRef.current);

    timerRef.current = null;

    setCallStatus('Call ended');

    setTimeout(() => {
    setCallStatus('');
    }, 2000);

    setCallDuration(0);
    pendingCandidatesRef.current = [];
    setIncomingCall(null);
    setCallUserId(null);
    setIsCalling(false);
    setIsInCall(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setCameraMode('user');
  };

  const flushPendingCandidates = async () => {
  if (!peerRef.current) return;

  for (const candidate of pendingCandidatesRef.current) {
    try {
      await peerRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (err) {
      console.error('Flush ICE candidate error:', err);
    }
  }

  pendingCandidatesRef.current = [];
};

  useEffect(() => {
  const handleIncomingCall = ({ from, offer, withVideo, caller }) => {
    if (isCalling || isInCall || peerRef.current) {
      return;
    }

    setCallStatus('Ringing...');

    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(() => {});
    }

    setIncomingCall({
      from,
      offer,
      withVideo,
      caller,
    });
  };

  const handleCallAnswered = async ({ answer }) => {
    if (!peerRef.current) return;

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

    await flushPendingCandidates();

    setIsCalling(false);
    setIsInCall(true);
    setCallStatus('In call');
    stopOutgoingRing();

    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    if (!candidate) return;

    if (!peerRef.current || !peerRef.current.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await peerRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (err) {
      console.error('Add ICE candidate error:', err);
    }
  };

  const handleCallEnded = () => {
    playCallEndedSound();
    cleanupCall();
  };
  const handleCallRejected = () => {
    playCallEndedSound();
    cleanupCall();

    setCallStatus('Call rejected');

    setTimeout(() => {
      setCallStatus('');
    }, 1500);
  };
const handleCallHandledOnOtherDevice = () => {

  stopAudio(ringtoneRef.current);

  setIncomingCall(null);
  setCallStatus('');
};

  socket.on('incomingCall', handleIncomingCall);
  socket.on('callAnswered', handleCallAnswered);
  socket.on('iceCandidate', handleIceCandidate);
  socket.on('callEnded', handleCallEnded);
  socket.on('callRejected', handleCallRejected);
  socket.on('callHandledOnOtherDevice', handleCallHandledOnOtherDevice);

  return () => {
    socket.off('incomingCall', handleIncomingCall);
    socket.off('callAnswered', handleCallAnswered);
    socket.off('iceCandidate', handleIceCandidate);
    socket.off('callEnded', handleCallEnded);
    socket.off('callRejected', handleCallRejected);
    socket.off('callHandledOnOtherDevice', handleCallHandledOnOtherDevice);
  };
}, [isCalling, isInCall]);


const attachVideoStreams = useCallback(() => {
  if (localVideoRef.current && localStreamRef.current) {
    localVideoRef.current.srcObject = localStreamRef.current;
  }

  if (
    remoteVideoRef.current &&
    remoteAudioRef.current?.srcObject
  ) {
    remoteVideoRef.current.srcObject = remoteAudioRef.current.srcObject;
  }
}, []);

  return {
    incomingCall,
    isCalling,
    isInCall,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    callStatus,
    callDuration,
    isMuted,
    toggleMute,
    attachVideoStreams,
    isVideoCall,
    ringtoneRef,
    toggleCamera,
    isCameraOff,
    switchCamera,
    cameraMode,
  };
}
