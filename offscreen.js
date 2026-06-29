const SOUND_FILES = {
  marimba: 'sounds/chime-marimba.mp3',
  bell: 'sounds/chime-bell.mp3',
  kalimba: 'sounds/chime-kalimba.mp3',
  windchime: 'sounds/chime-windchime.mp3',
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PLAY_CHIME') {
    const file = SOUND_FILES[msg.sound] || SOUND_FILES.marimba;
    const audio = new Audio(chrome.runtime.getURL(file));
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }
});
