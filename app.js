// Configuration Configuration
const SUPABASE_URL = "https://udrzaxgqlxfbsjhrodoo.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_LQpn3gD-kgik4mgCikxppw_F22Fwwr3";
const supabase = SUPABASE_JS.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentModule = null;
let currentQuestions = [];
let activeQuestionIndex = 0;
let selectedOptionIndex = null;

// Auth Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('btn-login');
const signupBtn = document.getElementById('btn-signup');
const authSection = document.getElementById('auth-section');
const studySection = document.getElementById('study-section');

// Interface Elements
const streakDisplay = document.getElementById('streak-display');
const xpDisplay = document.getElementById('xp-display');
const submitAnswerBtn = document.getElementById('btn-submit-answer');
const feedbackDiv = document.getElementById('feedback');

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
    setupAuthListeners();
});

function setupAuthListeners() {
    signupBtn.addEventListener('click', async () => {
        const { data, error } = await supabase.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value
        });
        if (error) alert(error.message);
        else alert('Signup successful! Log in to access your dashboard.');
    });

    loginBtn.addEventListener('click', async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value
        });
        if (error) alert(error.message);
        else {
            currentUser = data.user;
            authSection.classList.add('hidden');
            studySection.classList.remove('hidden');
            await loadUserProfile();
            await loadTodayModule();
        }
    });
}

async function loadUserProfile() {
    let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (!profile) {
        // Create an initial profile mapping if none exists
        const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: currentUser.id, username: currentUser.email.split('@')[0], xp: 0, streak: 0 }])
            .select()
            .single();
        profile = newProfile;
    }

    streakDisplay.innerText = `🔥 ${profile.streak} Days`;
    xpDisplay.innerText = `💎 ${profile.xp} XP`;
}

async function loadTodayModule() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Fetch curriculum metadata matching today's timeline entry
    let { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('date_scheduled', todayStr)
        .single();

    if (!moduleData) {
        // Default to loading the first entry if today falls outside active intervals
        let { data: firstModule } = await supabase.from('modules').select('*').limit(1).single();
        moduleData = firstModule;
    }

    if (moduleData) {
        currentModule = moduleData;
        document.getElementById('topic-title').innerText = `${moduleData.subject}: ${moduleData.topic_title}`;
        document.getElementById('task-desc').innerText = moduleData.task_description;
        document.getElementById('resource-link').href = moduleData.resource_url;

        // Fetch corresponding question assets
        let { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('module_id', currentModule.id);
        
        currentQuestions = qData || [];
        activeQuestionIndex = 0;
        renderQuestion();
    }
}

function renderQuestion() {
    feedbackDiv.classList.add('hidden');
    submitAnswerBtn.disabled = true;
    selectedOptionIndex = null;

    if (currentQuestions.length === 0 || activeQuestionIndex >= currentQuestions.length) {
        document.getElementById('quiz-container').innerHTML = "<h3>🎉 Core Unit Cleared! Keep up the great work!</h3>";
        awardXP(20);
        return;
    }

    const currentQ = currentQuestions[activeQuestionIndex];
    document.getElementById('question-text').innerText = currentQ.question_text;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    currentQ.options.forEach((opt, idx) => {
        const optCard = document.createElement('div');
        optCard.className = 'option-card';
        optCard.innerText = opt;
        optCard.addEventListener('click', () => {
            document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            optCard.classList.add('selected');
            selectedOptionIndex = idx;
            submitAnswerBtn.disabled = false;
        });
        optionsContainer.appendChild(optCard);
    });

    const progress = ((activeQuestionIndex) / currentQuestions.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

submitAnswerBtn.onclick = () => {
    const currentQ = currentQuestions[activeQuestionIndex];
    feedbackDiv.classList.remove('hidden');

    if (selectedOptionIndex === currentQ.correct_option_index) {
        feedbackDiv.className = "feedback-message correct";
        feedbackDiv.innerText = "Excellent! That is correct.";
        submitAnswerBtn.innerText = "Next Question";
        submitAnswerBtn.onclick = () => {
            activeQuestionIndex++;
            submitAnswerBtn.innerText = "Verify Answer";
            renderQuestion();
        };
    } else {
        feedbackDiv.className = "feedback-message incorrect";
        feedbackDiv.innerText = `Incorrect. Try reviewing the resource mapping above!`;
    }
};

async function awardXP(amount) {
    // Update remote profile parameters
    await supabase.rpc('increment_xp', { row_id: currentUser.id, x_amt: amount });
    await loadUserProfile();
}
