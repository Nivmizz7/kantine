const API_BASE = '/kantine/api';
const menuForm = document.getElementById('menu-form');
const sendForm = document.getElementById('send-form');
const scheduleForm = document.getElementById('schedule-form');
const menuStatus = document.getElementById('menu-status');
const sendStatus = document.getElementById('send-status');
const scheduleStatus = document.getElementById('schedule-status');

const categories = ['Kantine', 'Amerikain', 'Italien'];

init();

async function init() {
  try {
    const state = await request('GET', 'state');
    categories.forEach((key) => {
      const field = menuForm?.elements[key];
      if (field) {
        field.value = (state.menus?.[key] ?? []).join('\n');
      }
    });

    if (state.settings?.defaultChannelId) {
      sendForm.elements.channelId.value = state.settings.defaultChannelId;
      if (scheduleForm) {
        scheduleForm.elements.channelId.value = state.settings.defaultChannelId;
      }
    }

    if (state.settings?.lastTitle) {
      sendForm.elements.title.value = state.settings.lastTitle;
    }

    if (state.settings?.lastScheduleTitle && scheduleForm) {
      scheduleForm.elements.title.value = state.settings.lastScheduleTitle;
    }
  } catch (error) {
    menuStatus.textContent = `Impossible de charger l'état : ${error.message}`;
  }
}

menuForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(menuForm);
  const payload = {};
  categories.forEach((key) => {
    const value = formData.get(key) || '';
    payload[key] = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  });

  menuStatus.textContent = 'Sauvegarde en cours...';
  try {
    await request('POST', 'menus', { menus: payload });
    menuStatus.textContent = 'Menus sauvegardés ✅';
  } catch (error) {
    menuStatus.textContent = error.message;
  }
});

sendForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(sendForm);
  const payload = {
    channelId: formData.get('channelId'),
    title: formData.get('title')
  };

  sendStatus.textContent = 'Envoi en cours...';
  try {
    const response = await request('POST', 'send', payload);
    sendStatus.textContent = `Message envoyé (#${response.channelId})`;
  } catch (error) {
    sendStatus.textContent = error.message;
  }
});

if (scheduleForm) {
  scheduleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(scheduleForm);
    const payload = {
      channelId: formData.get('channelId'),
      title: formData.get('title')
    };

    scheduleStatus.textContent = 'Envoi en cours...';
    try {
      const response = await request('POST', 'send-schedule', payload);
      scheduleStatus.textContent = `Message horaires envoyé (#${response.channelId})`;
    } catch (error) {
      scheduleStatus.textContent = error.message;
    }
  });
}

async function request(method, endpoint, body) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Erreur ${response.status}`);
  }

  return response.json();
}
