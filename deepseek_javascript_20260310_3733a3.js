// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Данные пользователя с рейтингом
let userData = {
    id: null,
    firstName: '',
    lastName: '',
    username: '',
    photoUrl: '',
    rating: 1200, // Начальный рейтинг
    ratingHistory: [],
    tournamentsPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0
};

// Услуги (без изменений)
let services = [
    {
        id: 1,
        icon: '👑',
        title: 'Индивидуальные уроки',
        description: 'Персональные занятия с гроссмейстером. Разбор партий, дебютная подготовка',
        price: '2000₽/час'
    },
    {
        id: 2,
        icon: '📚',
        title: 'Групповые занятия',
        description: 'Занятия в мини-группах до 4 человек. Разбор тактики и стратегии',
        price: '800₽/занятие'
    },
    {
        id: 3,
        icon: '🎯',
        title: 'Подготовка к турнирам',
        description: 'Интенсивная подготовка к соревнованиям любого уровня',
        price: '3000₽/занятие'
    },
    {
        id: 4,
        icon: '♟️',
        title: 'Онлайн-курс',
        description: 'Базовый курс шахмат с видеоуроками и домашними заданиями',
        price: '5000₽/месяц'
    }
];

// Турниры с рейтинговыми категориями
let tournaments = [
    {
        id: 1,
        name: 'Блиц-турнир "Весенний гамбит"',
        date: '15 марта 2024',
        time: '18:00',
        format: 'Блиц (3+2)',
        prize: '10 000₽',
        participants: 12,
        maxParticipants: 20,
        ratingCategory: 'intermediate',
        minRating: 1200,
        maxRating: 1600,
        ratingChange: 16 // Максимальное изменение рейтинга
    },
    {
        id: 2,
        name: 'Классические выходные',
        date: '17-18 марта 2024',
        time: '11:00',
        format: 'Классика (90+30)',
        prize: 'Кубок + 5000₽',
        participants: 8,
        maxParticipants: 16,
        ratingCategory: 'advanced',
        minRating: 1600,
        maxRating: 2000,
        ratingChange: 24
    },
    {
        id: 3,
        name: 'Рапид "Детский мат"',
        date: '20 марта 2024',
        time: '15:00',
        format: 'Рапид (15+10)',
        prize: 'Сертификаты',
        participants: 5,
        maxParticipants: 12,
        ratingCategory: 'beginner',
        minRating: 0,
        maxRating: 1200,
        ratingChange: 12
    },
    {
        id: 4,
        name: 'Гроссмейстерский турнир',
        date: '25 марта 2024',
        time: '14:00',
        format: 'Классика (90+30)',
        prize: '30 000₽ + кубок',
        participants: 4,
        maxParticipants: 8,
        ratingCategory: 'pro',
        minRating: 2000,
        maxRating: 3000,
        ratingChange: 32
    }
];

// Таблица лидеров
let leaderboard = [];

// Записи на турниры
let myTournaments = [];

// Загрузка данных пользователя
function loadUserData() {
    if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        userData = {
            ...userData,
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name || '',
            username: user.username || '',
            photoUrl: user.photo_url || ''
        };
        
        document.getElementById('userName').textContent = 
            `${userData.firstName} ${userData.lastName}`.trim();
        
        if (userData.photoUrl) {
            document.getElementById('userAvatar').innerHTML = 
                `<img src="${userData.photoUrl}" alt="avatar" style="width:48px;height:48px;border-radius:50%;">`;
        }
    }
    
    loadUserDataFromStorage();
}

// Загрузка из Telegram Cloud Storage
function loadUserDataFromStorage() {
    if (userData.id) {
        tg.CloudStorage.getItem(`user_${userData.id}`, (error, value) => {
            if (!error && value) {
                try {
                    const saved = JSON.parse(value);
                    userData = {...userData, ...saved};
                    updateRatingDisplay();
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        });
        
        tg.CloudStorage.getItem(`tournaments_${userData.id}`, (error, value) => {
            if (!error && value) {
                try {
                    myTournaments = JSON.parse(value);
                    updateProfileTab();
                } catch (e) {
                    console.error('Error parsing tournaments:', e);
                }
            }
        });
    }
}

// Сохранение данных
function saveUserData() {
    if (userData.id) {
        tg.CloudStorage.setItem(`user_${userData.id}`, JSON.stringify({
            rating: userData.rating,
            ratingHistory: userData.ratingHistory,
            tournamentsPlayed: userData.tournamentsPlayed,
            wins: userData.wins,
            draws: userData.draws,
            losses: userData.losses
        }));
        
        tg.CloudStorage.setItem(`tournaments_${userData.id}`, JSON.stringify(myTournaments));
    }
}

// Обновление отображения рейтинга
function updateRatingDisplay() {
    document.getElementById('userRating').textContent = `Рейтинг: ${userData.rating}`;
    document.getElementById('profileRating').textContent = userData.rating;
    document.getElementById('statRating').textContent = userData.rating;
    
    // Обновляем имя в профиле
    document.getElementById('profileName').textContent = 
        `${userData.firstName} ${userData.lastName}`.trim() || 'Игрок';
}

// Расчет изменения рейтинга (система Эло)
function calculateRatingChange(playerRating, opponentAvgRating, result, maxChange) {
    // result: 1 - победа, 0.5 - ничья, 0 - поражение
    const expected = 1 / (1 + Math.pow(10, (opponentAvgRating - playerRating) / 400));
    const change = Math.round(maxChange * (result - expected));
    return Math.max(-maxChange, Math.min(maxChange, change));
}

// Добавление результата турнира
function addTournamentResult(tournament, result, opponents) {
    const avgOpponentRating = opponents.reduce((sum, r) => sum + r, 0) / opponents.length;
    const ratingChange = calculateRatingChange(
        userData.rating, 
        avgOpponentRating, 
        result === 'win' ? 1 : (result === 'draw' ? 0.5 : 0),
        tournament.ratingChange
    );
    
    userData.rating += ratingChange;
    userData.tournamentsPlayed++;
    
    if (result === 'win') userData.wins++;
    else if (result === 'draw') userData.draws++;
    else userData.losses++;
    
    userData.ratingHistory.push({
        date: new Date().toLocaleDateString(),
        change: ratingChange,
        tournament: tournament.name,
        newRating: userData.rating
    });
    
    // Ограничиваем историю 20 записями
    if (userData.ratingHistory.length > 20) {
        userData.ratingHistory = userData.ratingHistory.slice(-20);
    }
    
    updateRatingDisplay();
    saveUserData();
}

// Рендеринг услуг
function renderServices() {
    const container = document.getElementById('servicesList');
    container.innerHTML = services.map(service => `
        <div class="service-card">
            <div class="service-icon">${service.icon}</div>
            <h3 class="service-title">${service.title}</h3>
            <p class="service-description">${service.description}</p>
            <div class="service-price">${service.price}</div>
        </div>
    `).join('');
}

// Рендеринг турниров с фильтром
function renderTournaments(filter = 'all') {
    const container = document.getElementById('tournamentsList');
    
    let filteredTournaments = tournaments;
    if (filter !== 'all') {
        filteredTournaments = tournaments.filter(t => t.ratingCategory === filter);
    }
    
    container.innerHTML = filteredTournaments.map(tournament => {
        const categoryClass = tournament.ratingCategory;
        const ratingRange = `${tournament.minRating}-${tournament.maxRating}`;
        
        return `
            <div class="tournament-card ${categoryClass}" data-id="${tournament.id}">
                <div class="tournament-header">
                    <span class="tournament-name">${tournament.name}</span>
                    <span class="tournament-rating-badge">${ratingRange}</span>
                </div>
                <div class="tournament-info">
                    <span>📅 ${tournament.date}</span>
                    <span>⏰ ${tournament.time}</span>
                    <span>⚡ ${tournament.format}</span>
                    <span>🏆 ${tournament.prize}</span>
                    <span>👥 ${tournament.participants}/${tournament.maxParticipants}</span>
                </div>
            </div>
        `;
    }).join('');

    // Добавляем обработчики
    document.querySelectorAll('.tournament-card').forEach(card => {
        card.addEventListener('click', () => selectTournament(card.dataset.id));
    });
}

// Рендеринг таблицы лидеров
function renderLeaderboard() {
    // Создаем тестовые данные для демонстрации
    if (leaderboard.length === 0) {
        leaderboard = [
            { name: 'GM Александр Иванов', rating: 2750, change: '+15' },
            { name: 'IM Дмитрий Петров', rating: 2520, change: '+8' },
            { name: 'FM Сергей Сидоров', rating: 2380, change: '-5' },
            { name: userData.firstName + ' ' + userData.lastName, rating: userData.rating, change: '0' },
            { name: 'Анна Козлова', rating: 1950, change: '+12' }
        ];
        
        // Сортируем по рейтингу
        leaderboard.sort((a, b) => b.rating - a.rating);
    }
    
    const container = document.getElementById('leaderboardList');
    container.innerHTML = leaderboard.map((player, index) => `
        <div class="leaderboard-item ${player.name.includes(userData.firstName) ? 'current-user' : ''}">
            <span class="leaderboard-rank">${index + 1}</span>
            <span class="leaderboard-name">${player.name}</span>
            <span class="leaderboard-rating">${player.rating}</span>
            <span class="leaderboard-change ${player.change.startsWith('+') ? 'positive' : 'negative'}">
                ${player.change}
            </span>
        </div>
    `).join('');
}

// Рендеринг рейтинговых турниров
function renderRatingTournaments() {
    const container = document.getElementById('ratingTournamentsList');
    container.innerHTML = tournaments.map(tournament => {
        const isEligible = userData.rating >= tournament.minRating && 
                          userData.rating <= tournament.maxRating;
        
        return `
            <div class="tournament-card ${tournament.ratingCategory}" style="opacity: ${isEligible ? 1 : 0.6}">
                <div class="tournament-header">
                    <span class="tournament-name">${tournament.name}</span>
                    <span class="tournament-rating-badge">
                        ${isEligible ? '✓ Доступен' : '✗ Недоступен'}
                    </span>
                </div>
                <div class="tournament-info">
                    <span>📊 Требуемый рейтинг: ${tournament.minRating}-${tournament.maxRating}</span>
                    <span>📈 Изменение: до ${tournament.ratingChange} очков</span>
                </div>
            </div>
        `;
    }).join('');
}

// Рендеринг истории рейтинга
function renderRatingHistory() {
    const container = document.getElementById('ratingHistory');
    
    if (userData.ratingHistory.length === 0) {
        container.innerHTML = '<p class="empty-list">История рейтинга пуста</p>';
        return;
    }
    
    container.innerHTML = userData.ratingHistory.map(item => `
        <div class="history-item">
            <div>
                <div class="history-date">${item.date}</div>
                <div>${item.tournament}</div>
            </div>
            <div class="history-change ${item.change > 0 ? 'positive' : 'negative'}">
                ${item.change > 0 ? '+' : ''}${item.change}
                <br>
                <small>→ ${item.newRating}</small>
            </div>
        </div>
    `).join('');
}

// Выбор турнира
function selectTournament(tournamentId) {
    const tournament = tournaments.find(t => t.id == tournamentId);
    
    // Проверяем соответствие рейтингу
    if (userData.rating < tournament.minRating || userData.rating > tournament.maxRating) {
        showNotification(`Ваш рейтинг (${userData.rating}) не подходит для этого турнира`);
        return;
    }
    
    document.querySelectorAll('.tournament-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-id="${tournamentId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    const registrationSection = document.getElementById('registrationSection');
    registrationSection.style.display = 'block';