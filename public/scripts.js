document.addEventListener('DOMContentLoaded', () => {
  
  // — login —
  const loginDiv  = document.getElementById('login-container');
  const dashDiv   = document.getElementById('dashboard');
  const devInput  = document.getElementById('login-deviceId');
  const pwdInput  = document.getElementById('login-password');
  const loginBtn  = document.getElementById('login-button');
  const errorEl   = document.getElementById('login-error');

  // — dashboard —
  const deviceNameEl = document.getElementById('deviceName');
  const motorTempEl  = document.getElementById('motorTemp');
  const motorVibEl   = document.getElementById('motorVibration');
  const mensajes  = document.getElementById('mensajes');
  const tempCritIn   = document.getElementById('tempThreshold');
  const tempCritCur  = document.getElementById('tempCurrent');
  const vibCritIn    = document.getElementById('vibThreshold');
  const vibCritCur   = document.getElementById('vibCurrent');
  const tempAlarmLed = document.getElementById('tempAlarmLed');
  const vibAlarmLed  = document.getElementById('vibAlarmLed');
  const saveCritBtn  = document.getElementById('saveThresholdsBtn');
  const disableAlarmB= document.getElementById('deactivateAlarmBtn');
  const closeBtn     = document.getElementById('closeBtn');

  const socket = io.connect();
  let deviceId     = null;
  let loginPending = false;
  let loggedIn     = false;
  let loginTimeout = null;

  function showLoginError(msg) {
    errorEl.innerText = msg;
    loginBtn.disabled = false;
  }

  // — Entrar —
  loginBtn.addEventListener('click', () => {
    const dev = devInput.value.trim();
    const pwd = pwdInput.value;
    if (!dev || !pwd) return showLoginError('Debe ingresar DeviceID y contraseña');

    deviceId = dev;
    deviceNameEl.innerText = deviceId;
    loginBtn.disabled      = true;
    errorEl.innerText       = '';

    // 1) WS subscribe
    socket.emit('subscribe', deviceId);
    // 2) WS publish password
    socket.emit('publish', {
      topic: `${deviceId}/password`,
      message: pwd
    });
    // 3) espero respuesta mensaje
    loginPending = true;
    loginTimeout = setTimeout(() => {
      if (loginPending) {
        socket.emit('unsubscribe', deviceId);
        loginPending = false;
        showLoginError('Tiempo agotado de login');
      }
    }, 5000);
  });


/////////////////////////
  // ————— Inicializar gráficas —————
// ————— Gráfica de Temperatura —————
const ctxTemp = document.getElementById('chartTempMotor').getContext('2d');
// 1) Creamos un degradado vertical
const gradTemp = ctxTemp.createLinearGradient(0, 0, 0, 200);
gradTemp.addColorStop(0, 'rgba(255, 99, 132, 0.5)');
gradTemp.addColorStop(1, 'rgba(255, 99, 132, 0)');

const tempChart = new Chart(ctxTemp, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Temperatura Motor (°C)',
      data: [],
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: gradTemp,
      borderWidth: 2,
      tension: 0.3,               // curva suave
      borderDash: [6, 4],         // línea punteada
      pointStyle: 'rectRounded',
      pointRadius: 2,
      pointBackgroundColor: '#fff',
      pointBorderColor: 'rgba(255, 99, 132, 1)',
      fill: 'start'               // rellena hacia abajo
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    scales: {
      x: { 
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      },
      y: { 
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#333', padding: 20 }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 4
      }
    }
  }
});

// ————— Gráfica de Vibración —————
const ctxVib = document.getElementById('chartVibMotor').getContext('2d');
// degradado más sutil
const gradVib = ctxVib.createLinearGradient(0, 0, 0, 200);
gradVib.addColorStop(0, 'rgba(60,194,34,0.3)');
gradVib.addColorStop(1, 'rgba(60,194,34,0)');

const vibChart = new Chart(ctxVib, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Vibración Máquina (mm/s2)',
      data: [],
      borderColor: '#3CC222',
      backgroundColor: gradVib,
      borderWidth: 3,
      tension: 0.2,
      borderDash: [],              // línea continua
      pointStyle: 'triangle',
      pointRadius: 3,
      pointBackgroundColor: '#3CC222',
      pointHoverRadius: 8,
      fill: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 100 },
    scales: {
      x: {
        grid: { drawBorder: false, color: 'rgba(0,0,0,0.03)' },
        ticks: { autoSkip: true, maxTicksLimit: 8 }
      },
      y: {
        beginAtZero: false,
        grid: { drawBorder: false, color: 'rgba(0,0,0,0.03)' }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, color: '#333' }
      },
      tooltip: {
        backgroundColor: '#222',
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 3
      }
    }
  }
});


  // Helper para añadir puntos y mantener ventana de 20 muestras
  function updateChart(chart, value) {
    const now = new Date().toLocaleTimeString();
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(parseFloat(value));
    if (chart.data.labels.length > 100) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

//////////////////////////
  // — Handler global de updates —
  socket.on('deviceStatusUpdate', ({ device, control, state }) => {
    // login flow
    if (loginPending && device === deviceId && control === 'mensaje') {
      clearTimeout(loginTimeout);
      loginPending = false;
      if (state === 'OK') {
        loggedIn        = true;
        loginDiv.style.display = 'none';
        dashDiv.style.display  = 'block';
      } else {
        socket.emit('unsubscribe', deviceId);
        showLoginError('Credenciales incorrectas');
      }
      return;
    }

    // antes de login o topic de otro device → ignoro
    if (!loggedIn || device !== deviceId) return;

    // ya dentro → actualizar UI
    switch (control) {
      case 'temp':
        motorTempEl.innerText = `${state} °C`;
        updateChart(tempChart, state);         // <— aquí actualizo la gráfica
        break;
      case 'vibracion':
        motorVibEl.innerText = `${state} mm/s2`;
        updateChart(vibChart, state);          // <— y aquí actualizo la gráfica
        break;
      case 'tempCritica':
        tempCritIn.value      = state;
        tempCritCur.innerText = `${state} °C`;
        break;
      case 'vibracionCritica':
        vibCritIn.value       = state;
        vibCritCur.innerText  = `${state} mm/s2`;
        break;
      case 'tempAlarm':
        tempAlarmLed.classList.toggle('on', state === 'ON');
        break;
      case 'vibracionAlarm':
        vibAlarmLed.classList.toggle('on', state === 'ON');
        break;
      case 'buzzerStatus':
        // buzzerLed.classList.toggle('on', state === 'ON');
         if (state === 'ON') {
      // Activar color + parpadeo
        buzzerIcon.classList.add('on', 'blink');
        } else {
          // Desactivar
          buzzerIcon.classList.remove('on', 'blink');
        }
        break;
      case 'mensaje':
        // detectar nivel según prefijo
        const txt = state.trim();
        const lower = txt.toLowerCase();
        let level = 'info';
        if (lower.startsWith('error')) level = 'error';
        else if (lower.startsWith('warn')) level = 'warn';
        appendLog(txt, level);
        break;
    }
  });

// — Helper para añadir líneas al panel de logs —
function appendLog(msg, level = 'info') {
  const container = document.getElementById('mensajes');
  const p = document.createElement('p');

  // timestamp HH:MM:SS
  const now = new Date();
  const ts = now.toLocaleTimeString('es-ES', { hour12: false });

  p.textContent = `[${ts}] ${msg}`;
  p.classList.add(level); // espera .info, .warn o .error
  container.appendChild(p);
  container.scrollTop = container.scrollHeight;
}

  // — acciones post-login —
  saveCritBtn.addEventListener('click', () => {
    socket.emit('publish',{ topic:`${deviceId}/tempCritica`,      message: tempCritIn.value });
    socket.emit('publish',{ topic:`${deviceId}/vibracionCritica`, message: vibCritIn.value  });
  });
  disableAlarmB.addEventListener('click', () => {
    socket.emit('publish',{ topic:`${deviceId}/buzzerControl`, message:'OFF' });
  });
  closeBtn.addEventListener('click', () => dashDiv.style.display = 'none');
  window.addEventListener('beforeunload', () => {
    if (deviceId) socket.emit('unsubscribe', deviceId);
  });
});
