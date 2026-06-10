(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['paciente']);
  if (!user) return;

  const doctors = [
    {
      id: 'sara-rodrigues',
      nome: 'Dra. Sara Rodrigues',
      especialidade: 'Clínica Geral',
      descricao: 'Olá! Vou te acompanhar para encontrar o melhor plano de cuidado para sua saúde.',
      disponibilidade: {
        'Segunda-feira': ['08:00', '09:30', '14:00'],
        'Quarta-feira': ['10:00', '11:30', '16:00'],
        'Sexta-feira': ['09:00', '13:30', '15:30']
      }
    },
    {
      id: 'marcos-lima',
      nome: 'Dr. Marcos Lima',
      especialidade: 'Cardiologia',
      descricao: 'Seja bem-vindo(a)! Vamos avaliar sua saúde do coração com atenção e segurança.',
      disponibilidade: {
        'Terça-feira': ['08:30', '10:30', '15:00'],
        'Quinta-feira': ['09:00', '11:00', '17:00'],
        Sábado: ['08:00', '09:00']
      }
    },
    {
      id: 'ana-beatriz-melo',
      nome: 'Dra. Ana Beatriz Melo',
      especialidade: 'Dermatologia',
      descricao: 'Prazer em receber você! Vamos cuidar da sua pele com uma avaliação personalizada.',
      disponibilidade: {
        'Segunda-feira': ['11:00', '13:00'],
        'Quinta-feira': ['14:00', '16:00', '18:00'],
        'Sexta-feira': ['10:00', '12:00']
      }
    }
  ];

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const welcomeText = document.getElementById('welcomeText');
  const logoutBtn = document.getElementById('logoutBtn');

  const doctorList = document.getElementById('doctorList');
  const doctorShowcase = document.getElementById('doctorShowcase');

  const doctorDetailsCard = document.getElementById('doctorDetailsCard');
  const doctorDetails = document.getElementById('doctorDetails');
  const dayList = document.getElementById('dayList');

  const timeCard = document.getElementById('timeCard');
  const selectedDayText = document.getElementById('selectedDayText');
  const timeList = document.getElementById('timeList');

  const confirmCard = document.getElementById('confirmCard');
  const bookingSummary = document.getElementById('bookingSummary');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');

  const myAppointments = document.getElementById('myAppointments');
  const confirmationCard = document.getElementById('confirmationCard');

  const defaultState = {
    doctorId: null,
    day: null,
    time: null
  };

  let bookingState = { ...defaultState };

  function setActivePanel(targetId) {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
  }

  function doctorById(id) {
    return doctors.find((doctor) => doctor.id === id) || null;
  }

  function createDoctorCard(doctor, onClick, selected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `doctor-card${selected ? ' selected' : ''}`;

    const title = document.createElement('strong');
    title.textContent = doctor.nome;
    const specialty = document.createElement('p');
    specialty.textContent = doctor.especialidade;

    button.append(title, specialty);
    button.addEventListener('click', onClick);
    return button;
  }

  function renderDoctorLists() {
    doctorList.innerHTML = '';
    doctorShowcase.innerHTML = '';

    doctors.forEach((doctor) => {
      const selected = doctor.id === bookingState.doctorId;
      doctorList.appendChild(
        createDoctorCard(doctor, () => {
          bookingState = { ...bookingState, doctorId: doctor.id, day: null, time: null };
          renderFlow();
        }, selected)
      );

      const showcaseCard = document.createElement('article');
      showcaseCard.className = 'doctor-card';

      const name = document.createElement('strong');
      name.textContent = doctor.nome;
      const specialty = document.createElement('p');
      specialty.textContent = doctor.especialidade;
      const days = document.createElement('p');
      days.className = 'hint';
      days.textContent = `Dias: ${Object.keys(doctor.disponibilidade).join(', ')}`;

      showcaseCard.append(name, specialty, days);
      doctorShowcase.appendChild(showcaseCard);
    });
  }

  function renderDays(doctor) {
    dayList.innerHTML = '';

    Object.keys(doctor.disponibilidade).forEach((day) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${bookingState.day === day ? ' selected' : ''}`;
      chip.textContent = day;
      chip.addEventListener('click', () => {
        bookingState = { ...bookingState, day, time: null };
        renderFlow();
      });
      dayList.appendChild(chip);
    });
  }

  function renderTimes(doctor) {
    timeList.innerHTML = '';

    const times = doctor.disponibilidade[bookingState.day] || [];
    selectedDayText.textContent = bookingState.day
      ? `Horários disponíveis para ${bookingState.day}:`
      : 'Selecione um dia para ver os horários disponíveis.';

    times.forEach((time) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${bookingState.time === time ? ' selected' : ''}`;
      chip.textContent = time;
      chip.addEventListener('click', () => {
        bookingState = { ...bookingState, time };
        renderFlow();
      });
      timeList.appendChild(chip);
    });
  }

  function renderMyAppointments() {
    myAppointments.innerHTML = '';
    const items = auth
      .getAppointments()
      .filter((appointment) => appointment.pacienteCpf === user.cpf)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Você ainda não possui consultas agendadas.';
      myAppointments.appendChild(empty);
      return;
    }

    items.forEach((appointment) => {
      const card = document.createElement('article');
      card.className = 'appointment-item';

      const title = document.createElement('strong');
      title.textContent = `${appointment.medicoNome} • ${appointment.especialidade}`;
      const details = document.createElement('p');
      details.className = 'hint';
      details.textContent = `${appointment.day} às ${appointment.time}`;

      card.append(title, details);
      myAppointments.appendChild(card);
    });
  }

  function showConfirmation(appointment) {
    confirmationCard.classList.remove('hidden');
    confirmationCard.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = 'Agendamento confirmado!';
    const client = document.createElement('p');
    client.textContent = `Paciente: ${appointment.pacienteNome}`;
    const doctor = document.createElement('p');
    doctor.textContent = `Médico: ${appointment.medicoNome}`;
    const specialty = document.createElement('p');
    specialty.textContent = `Especialidade: ${appointment.especialidade}`;
    const schedule = document.createElement('p');
    schedule.textContent = `${appointment.day} às ${appointment.time}`;

    const resetButton = document.createElement('button');
    resetButton.id = 'newBookingBtn';
    resetButton.className = 'btn';
    resetButton.type = 'button';
    resetButton.textContent = 'Novo agendamento';
    resetButton.addEventListener('click', () => {
      bookingState = { ...defaultState };
      confirmationCard.classList.add('hidden');
      setActivePanel('agendamento');
      renderFlow();
    });

    confirmationCard.append(title, client, doctor, specialty, schedule, resetButton);
  }

  function confirmBooking() {
    const selectedDoctor = doctorById(bookingState.doctorId);
    if (!selectedDoctor || !bookingState.day || !bookingState.time) {
      return;
    }

    const appointment = auth.addAppointment({
      pacienteCpf: user.cpf,
      pacienteNome: user.nome,
      medicoId: selectedDoctor.id,
      medicoNome: selectedDoctor.nome,
      especialidade: selectedDoctor.especialidade,
      day: bookingState.day,
      time: bookingState.time
    });

    showConfirmation(appointment);
    renderMyAppointments();
    setActivePanel('minhas-consultas');
  }

  function renderFlow() {
    renderDoctorLists();

    const selectedDoctor = doctorById(bookingState.doctorId);

    if (!selectedDoctor) {
      doctorDetailsCard.classList.add('hidden');
      timeCard.classList.add('hidden');
      confirmCard.classList.add('hidden');
      return;
    }

    doctorDetailsCard.classList.remove('hidden');
    doctorDetails.innerHTML = '';

    const name = document.createElement('p');
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = selectedDoctor.nome;
    name.appendChild(nameStrong);
    const specialty = document.createElement('p');
    specialty.textContent = selectedDoctor.especialidade;
    const description = document.createElement('p');
    description.className = 'hint';
    description.textContent = selectedDoctor.descricao;

    doctorDetails.append(name, specialty, description);
    renderDays(selectedDoctor);

    if (!bookingState.day) {
      timeCard.classList.add('hidden');
      confirmCard.classList.add('hidden');
      return;
    }

    timeCard.classList.remove('hidden');
    renderTimes(selectedDoctor);

    if (!bookingState.time) {
      confirmCard.classList.add('hidden');
      return;
    }

    confirmCard.classList.remove('hidden');
    bookingSummary.textContent = `${user.nome}, confirme sua consulta com ${selectedDoctor.nome} em ${bookingState.day}, às ${bookingState.time}.`;
  }

  welcomeText.textContent = `Olá, ${user.nome}`;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.target));
  });

  confirmBookingBtn.addEventListener('click', confirmBooking);

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  renderMyAppointments();
  renderFlow();
})();
