// ============================================================
// Voice Chat AI - OpenAI + ElevenLabs
// ============================================================

const $ = (sel) => document.querySelector(sel);

// --- State ---
const state = {
    openaiKey: '',
    elevenlabsKey: '',
    voiceId: '',
    systemPrompt: '',
    messages: [],        // OpenAI conversation history
    isRecording: false,
    isProcessing: false,
    mediaRecorder: null,
    audioChunks: [],
    recordingStart: 0,
    recordingTimer: null,
    audioContext: null,
    analyser: null,
    currentAudio: null,
};

// --- DOM Elements ---
const els = {
    setupScreen:    $('#setup-screen'),
    chatScreen:     $('#chat-screen'),
    openaiKey:      $('#openai-key'),
    elevenlabsKey:  $('#elevenlabs-key'),
    voiceSelect:    $('#voice-select'),
    loadVoicesBtn:  $('#load-voices-btn'),
    systemPrompt:   $('#system-prompt'),
    startBtn:       $('#start-btn'),
    backBtn:        $('#back-btn'),
    chatMessages:   $('#chat-messages'),
    textInput:      $('#text-input'),
    sendBtn:        $('#send-btn'),
    micBtn:         $('#mic-btn'),
    statusText:     $('#status-text'),
    aiAvatar:       $('#ai-avatar'),
    visualizer:     $('#visualizer'),
    vizContainer:   $('#visualizer-container'),
    recordingTime:  $('#recording-time'),
};

// ============================================================
// Setup Screen
// ============================================================

function checkSetupReady() {
    const ready = els.openaiKey.value.trim() && els.elevenlabsKey.value.trim() && els.voiceSelect.value;
    els.startBtn.disabled = !ready;
}

function checkElevenLabsKey() {
    const hasKey = els.elevenlabsKey.value.trim().length > 0;
    els.loadVoicesBtn.disabled = !hasKey;
}

els.openaiKey.addEventListener('input', checkSetupReady);
els.elevenlabsKey.addEventListener('input', () => {
    checkElevenLabsKey();
    checkSetupReady();
});
els.voiceSelect.addEventListener('change', checkSetupReady);

// Load ElevenLabs voices
els.loadVoicesBtn.addEventListener('click', async () => {
    const key = els.elevenlabsKey.value.trim();
    if (!key) return;

    els.loadVoicesBtn.textContent = 'Chargement...';
    els.loadVoicesBtn.disabled = true;

    try {
        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': key }
        });

        if (!res.ok) throw new Error('Cl\u00e9 invalide ou erreur API');

        const data = await res.json();
        els.voiceSelect.innerHTML = '<option value="">-- Choisir une voix --</option>';
        data.voices.forEach((voice) => {
            const opt = document.createElement('option');
            opt.value = voice.voice_id;
            opt.textContent = `${voice.name} (${voice.labels?.accent || voice.labels?.gender || 'custom'})`;
            els.voiceSelect.appendChild(opt);
        });
        els.voiceSelect.disabled = false;
    } catch (err) {
        alert('Erreur: ' + err.message);
    } finally {
        els.loadVoicesBtn.textContent = 'Charger les voix';
        els.loadVoicesBtn.disabled = false;
    }
});

// Start chat
els.startBtn.addEventListener('click', () => {
    state.openaiKey = els.openaiKey.value.trim();
    state.elevenlabsKey = els.elevenlabsKey.value.trim();
    state.voiceId = els.voiceSelect.value;
    state.systemPrompt = els.systemPrompt.value.trim() || 'Tu es un assistant vocal amical.';

    state.messages = [{ role: 'system', content: state.systemPrompt }];

    els.setupScreen.classList.remove('active');
    els.chatScreen.classList.add('active');
});

els.backBtn.addEventListener('click', () => {
    stopCurrentAudio();
    els.chatScreen.classList.remove('active');
    els.setupScreen.classList.add('active');
});

// ============================================================
// Chat Messages
// ============================================================

function addMessage(role, text) {
    // Remove welcome message
    const welcome = els.chatMessages.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `message ${role}`;

    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="bubble">${escapeHtml(text)}</div>
        <div class="meta">${time}</div>
    `;

    els.chatMessages.appendChild(div);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    return div;
}

function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="bubble">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    els.chatMessages.appendChild(div);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    return div;
}

function removeTypingIndicator() {
    const el = $('#typing-indicator');
    if (el) el.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setStatus(text) {
    els.statusText.textContent = text;
}

// ============================================================
// Send Message (text or transcription)
// ============================================================

async function sendMessage(text) {
    if (!text.trim() || state.isProcessing) return;

    state.isProcessing = true;
    els.textInput.value = '';
    els.sendBtn.disabled = true;
    els.micBtn.disabled = true;

    // Add user message
    addMessage('user', text);
    state.messages.push({ role: 'user', content: text });

    // Show typing
    setStatus('R\u00e9fl\u00e9chit...');
    addTypingIndicator();

    try {
        // Call OpenAI
        const aiText = await callOpenAI(text);
        removeTypingIndicator();

        // Add AI message
        const msgEl = addMessage('assistant', aiText);
        state.messages.push({ role: 'assistant', content: aiText });

        // Generate speech
        setStatus('Parle...');
        els.aiAvatar.classList.add('speaking');
        await speakWithElevenLabs(aiText, msgEl);
    } catch (err) {
        removeTypingIndicator();
        addMessage('assistant', `Erreur: ${err.message}`);
        console.error(err);
    } finally {
        state.isProcessing = false;
        els.micBtn.disabled = false;
        els.aiAvatar.classList.remove('speaking');
        setStatus('En ligne');
        checkSendBtn();
    }
}

// ============================================================
// OpenAI API
// ============================================================

async function callOpenAI(userText) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.openaiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: state.messages,
            max_tokens: 500,
            temperature: 0.8,
        })
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenAI erreur ${res.status}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
}

// ============================================================
// ElevenLabs Text-to-Speech
// ============================================================

async function speakWithElevenLabs(text, msgEl) {
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${state.voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': state.elevenlabsKey,
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.5,
                    use_speaker_boost: true
                }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail?.message || `ElevenLabs erreur ${res.status}`);
        }

        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Add play button to message
        const audioIndicator = document.createElement('div');
        audioIndicator.className = 'audio-indicator';
        audioIndicator.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>\u00c9couter</span>
        `;
        audioIndicator.addEventListener('click', () => playAudio(audioUrl));
        msgEl.querySelector('.bubble').appendChild(audioIndicator);

        // Auto-play
        await playAudio(audioUrl);
    } catch (err) {
        console.error('ElevenLabs TTS error:', err);
    }
}

function playAudio(url) {
    return new Promise((resolve) => {
        stopCurrentAudio();
        const audio = new Audio(url);
        state.currentAudio = audio;
        els.aiAvatar.classList.add('speaking');

        audio.addEventListener('ended', () => {
            els.aiAvatar.classList.remove('speaking');
            state.currentAudio = null;
            resolve();
        });
        audio.addEventListener('error', () => {
            els.aiAvatar.classList.remove('speaking');
            state.currentAudio = null;
            resolve();
        });
        audio.play().catch(() => resolve());
    });
}

function stopCurrentAudio() {
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio = null;
        els.aiAvatar.classList.remove('speaking');
    }
}

// ============================================================
// Speech-to-Text (OpenAI Whisper)
// ============================================================

async function transcribeAudio(audioBlob) {
    setStatus('Transcription...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.openaiKey}`
        },
        body: formData
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Whisper erreur ${res.status}`);
    }

    const data = await res.json();
    return data.text;
}

// ============================================================
// Microphone Recording
// ============================================================

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        state.audioChunks = [];
        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm'
        });

        state.mediaRecorder.addEventListener('dataavailable', (e) => {
            if (e.data.size > 0) state.audioChunks.push(e.data);
        });

        state.mediaRecorder.addEventListener('stop', async () => {
            stream.getTracks().forEach(t => t.stop());
            stopVisualizer();

            if (state.audioChunks.length === 0) return;

            const blob = new Blob(state.audioChunks, { type: 'audio/webm' });

            try {
                const text = await transcribeAudio(blob);
                if (text && text.trim()) {
                    await sendMessage(text);
                }
            } catch (err) {
                addMessage('assistant', `Erreur transcription: ${err.message}`);
                state.isProcessing = false;
                els.micBtn.disabled = false;
                setStatus('En ligne');
            }
        });

        state.mediaRecorder.start(250);
        state.isRecording = true;
        state.recordingStart = Date.now();
        els.micBtn.classList.add('recording');

        // Timer
        updateRecordingTime();
        state.recordingTimer = setInterval(updateRecordingTime, 1000);

        // Visualizer
        startVisualizer(stream);
    } catch (err) {
        alert('Impossible d\'acc\u00e9der au micro: ' + err.message);
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
        els.micBtn.classList.remove('recording');

        clearInterval(state.recordingTimer);
        els.recordingTime.textContent = '0:00';
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - state.recordingStart) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    els.recordingTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Audio Visualizer
// ============================================================

function startVisualizer(stream) {
    els.vizContainer.classList.remove('hidden');

    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;

    const source = state.audioContext.createMediaStreamSource(stream);
    source.connect(state.analyser);

    const canvas = els.visualizer;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!state.isRecording) return;
        requestAnimationFrame(draw);

        state.analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const hue = 260 + (i / bufferLength) * 40;
            ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

function stopVisualizer() {
    els.vizContainer.classList.add('hidden');
    if (state.audioContext) {
        state.audioContext.close().catch(() => {});
        state.audioContext = null;
    }
}

// ============================================================
// Event Listeners
// ============================================================

// Text input
els.textInput.addEventListener('input', checkSendBtn);
els.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (els.textInput.value.trim()) {
            sendMessage(els.textInput.value.trim());
        }
    }
});

els.sendBtn.addEventListener('click', () => {
    if (els.textInput.value.trim()) {
        sendMessage(els.textInput.value.trim());
    }
});

function checkSendBtn() {
    els.sendBtn.disabled = !els.textInput.value.trim() || state.isProcessing;
}

// Mic button - push to talk
els.micBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.isProcessing && !state.isRecording) {
        startRecording();
    }
});

els.micBtn.addEventListener('mouseup', () => {
    if (state.isRecording) stopRecording();
});

els.micBtn.addEventListener('mouseleave', () => {
    if (state.isRecording) stopRecording();
});

// Touch support
els.micBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!state.isProcessing && !state.isRecording) {
        startRecording();
    }
});

els.micBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (state.isRecording) stopRecording();
});

els.micBtn.addEventListener('touchcancel', () => {
    if (state.isRecording) stopRecording();
});

// Restore keys from localStorage
(function restoreKeys() {
    const savedOpenAI = localStorage.getItem('vc_openai_key');
    const savedElevenLabs = localStorage.getItem('vc_elevenlabs_key');
    if (savedOpenAI) els.openaiKey.value = savedOpenAI;
    if (savedElevenLabs) els.elevenlabsKey.value = savedElevenLabs;
    checkElevenLabsKey();
    checkSetupReady();
})();

// Save keys on change
els.openaiKey.addEventListener('change', () => {
    localStorage.setItem('vc_openai_key', els.openaiKey.value.trim());
});
els.elevenlabsKey.addEventListener('change', () => {
    localStorage.setItem('vc_elevenlabs_key', els.elevenlabsKey.value.trim());
});
