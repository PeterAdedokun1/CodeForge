import { useState } from 'react';
import { Heart, User, MapPin, Phone, Baby } from 'lucide-react';
import { saveUser, UserSession } from '../lib/memoryStore';

interface LoginPageProps {
    onLogin: () => void;
}

const NIGERIAN_STATES = [
    'Lagos', 'Abuja (FCT)', 'Kano', 'Rivers', 'Oyo', 'Kaduna', 'Anambra', 'Delta',
    'Enugu', 'Benue', 'Kwara', 'Ogun', 'Ondo', 'Osun', 'Ekiti', 'Abia',
    'Akwa Ibom', 'Bauchi', 'Borno', 'Cross River', 'Edo', 'Gombe', 'Imo',
    'Jigawa', 'Kebbi', 'Kogi', 'Nasarawa', 'Niger', 'Plateau', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara', 'Bayelsa', 'Ebonyi', 'Adamawa'
];

export const LoginPage = ({ onLogin }: LoginPageProps) => {
    const [step, setStep] = useState<'name' | 'details'>('name');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [gestationalWeek, setGestationalWeek] = useState('');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length >= 2) {
            setStep('details');
        }
    };

    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user: UserSession = {
            userId,
            name: name.trim(),
            age: age ? parseInt(age) : undefined,
            gestationalWeek: gestationalWeek ? parseInt(gestationalWeek) : undefined,
            location: location || undefined,
            phone: phone || undefined,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        saveUser(user);

        setTimeout(() => {
            setIsLoading(false);
            onLogin();
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl border border-white/30">
                        <Heart className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight">MIMI</h1>
                    <p className="text-pink-100 mt-1 text-sm font-medium">Maternal Intelligence Monitoring Interface</p>
                    <p className="text-white/60 text-xs mt-1">Powered by AI • Built for Nigerian Mothers</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {step === 'name' ? (
                        <form onSubmit={handleNameSubmit} className="p-8">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <User className="w-6 h-6 text-pink-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">Welcome, Mama!</h2>
                                <p className="text-gray-500 text-sm mt-1">Tell me your name so I can remember you</p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    What is your name?
                                </label>
                                <input
                                    id="login-name-input"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g., Amina, Funke, Zainab..."
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-800 text-lg transition-all"
                                    autoFocus
                                    required
                                    minLength={2}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={name.trim().length < 2}
                                id="login-name-continue"
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700
                  text-white font-bold py-3.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                            >
                                Continue →
                            </button>

                            <p className="text-center text-xs text-gray-400 mt-4">
                                No password needed. MIMI keeps your health data private on your device.
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleDetailsSubmit} className="p-8">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Baby className="w-6 h-6 text-purple-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">Hello, {name}! 👋</h2>
                                <p className="text-gray-500 text-sm mt-1">Help MIMI know you better (optional)</p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Your Age</label>
                                        <input
                                            id="login-age-input"
                                            type="number"
                                            value={age}
                                            onChange={e => setAge(e.target.value)}
                                            placeholder="e.g. 25"
                                            min="15" max="55"
                                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Pregnancy Week</label>
                                        <input
                                            id="login-week-input"
                                            type="number"
                                            value={gestationalWeek}
                                            onChange={e => setGestationalWeek(e.target.value)}
                                            placeholder="e.g. 28"
                                            min="4" max="42"
                                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        <MapPin className="w-3 h-3 inline mr-1" />
                                        Location (State)
                                    </label>
                                    <select
                                        id="login-location-select"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm text-gray-700"
                                    >
                                        <option value="">Select your state</option>
                                        {NIGERIAN_STATES.map(state => (
                                            <option key={state} value={state}>{state}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        <Phone className="w-3 h-3 inline mr-1" />
                                        Phone Number (for CHEW contact)
                                    </label>
                                    <input
                                        id="login-phone-input"
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="+234-800-000-0000"
                                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                <button
                                    type="submit"
                                    id="login-start-button"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700
                    text-white font-bold py-3.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]
                    disabled:opacity-60 shadow-lg flex items-center justify-center space-x-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Starting MIMI...</span>
                                        </>
                                    ) : (
                                        <span>Start Talking to MIMI 🎙️</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStep('name')}
                                    className="w-full text-gray-500 py-2 text-sm hover:text-gray-700"
                                >
                                    ← Go back
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer features */}
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[
                        { icon: '🔒', label: 'Private', desc: 'Data stays on your device' },
                        { icon: '📱', label: 'Offline', desc: 'Works without internet' },
                        { icon: '🎙️', label: 'Voice-First', desc: 'Speak in Pidgin English' }
                    ].map(f => (
                        <div key={f.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/20">
                            <div className="text-2xl mb-1">{f.icon}</div>
                            <p className="text-white text-xs font-bold">{f.label}</p>
                            <p className="text-white/60 text-xs mt-0.5">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
