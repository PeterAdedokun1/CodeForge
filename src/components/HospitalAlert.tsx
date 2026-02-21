import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Phone, MapPin, Clock, X, Check, FileText, Navigation, Volume2, Building2 } from 'lucide-react';

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gestationalWeek: number;
  riskType: string;
  symptoms: string[];
  timestamp: Date;
  location?: {
    address: string;
    coordinates: { lat: number; lng: number };
    eta?: string;
  };
  status: 'pending' | 'acknowledged' | 'resolved';
  priority: 'medium' | 'high' | 'critical';
}

interface HospitalAlertProps {
  alerts: Alert[];
  hospitalName: string;
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onContact?: (patientId: string) => void;
  enableSound?: boolean;
}

// Nearby hospitals data (real Lagos hospitals around Ajegunle)
const NEARBY_HOSPITALS = [
  {
    name: 'Lagos Island General Hospital',
    address: 'Broad Street, Lagos Island',
    distance: '8.2 km',
    lat: 6.4541,
    lng: 3.3947,
    phone: '+234-1-460-4051'
  },
  {
    name: 'Lagos University Teaching Hospital (LUTH)',
    address: 'Ishaga Road, Idiaraba, Lagos',
    distance: '12.5 km',
    lat: 6.5185,
    lng: 3.3518,
    phone: '+234-1-774-5418'
  },
  {
    name: 'Apapa General Hospital',
    address: '1 Hospital Road, Apapa, Lagos',
    distance: '3.1 km',
    lat: 6.4524,
    lng: 3.3631,
    phone: '+234-1-545-3021'
  }
];

// Simulated "nurse call" audio (plays a ring tone effect)
function simulateNurseCall(patientName: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const script = `Hello? This is Nurse Chioma calling from Lagos University Teaching Hospital. Am I speaking with ${patientName}? We received an urgent alert from your MIMI health companion. How are you feeling right now, Mama? We are sending an ambulance to your location. Please stay calm. Help is on the way.`;

  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = 0.85;
  utterance.pitch = 1.1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const femaleVoice = voices.find(v =>
    v.name.includes('Female') ||
    v.name.includes('Samantha') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Karen')
  );
  if (femaleVoice) utterance.voice = femaleVoice;

  window.speechSynthesis.speak(utterance);
}

export const HospitalAlert = ({
  alerts,
  hospitalName,
  onAcknowledge,
  onDismiss,
  onContact: _onContact,
  enableSound = true
}: HospitalAlertProps) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [showHospitals, setShowHospitals] = useState(false);
  const [callSimulatorActive, setCallSimulatorActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (soundEnabled && !hasPlayedRef.current && alerts.some(a => a.status === 'pending' && a.priority === 'critical')) {
      hasPlayedRef.current = true;
      // Beep pattern using AudioContext
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playBeep = (delay: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.3);
        };
        [0, 0.4, 0.8].forEach(d => playBeep(d));
      } catch { }
    }
  }, [alerts, soundEnabled]);

  const getPriorityConfig = (priority: 'medium' | 'high' | 'critical') => {
    const config = {
      medium: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-500',
        text: 'text-yellow-800',
        badge: 'bg-yellow-500',
        icon: <AlertTriangle className="w-6 h-6" />
      },
      high: {
        bg: 'bg-orange-50',
        border: 'border-orange-500',
        text: 'text-orange-800',
        badge: 'bg-orange-500',
        icon: <AlertTriangle className="w-6 h-6" />
      },
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-500',
        text: 'text-red-800',
        badge: 'bg-red-600',
        icon: <AlertTriangle className="w-6 h-6 animate-pulse" />
      }
    };
    return config[priority];
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    const hours = Math.floor(diff / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  const pendingAlerts = alerts.filter(a => a.status === 'pending');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');

  const handleSendAlertAndDirections = () => {
    setAlertSent(true);
    setShowHospitals(true);
  };

  const handleCallSimulator = () => {
    if (!selectedAlert) return;
    setCallSimulatorActive(true);
    simulateNurseCall(selectedAlert.patientName);
    setTimeout(() => setCallSimulatorActive(false), 20000);
  };

  if (selectedAlert) {
    const config = getPriorityConfig(selectedAlert.priority);

    return (
      <div className="max-w-4xl mx-auto p-4">
        <button
          onClick={() => { setSelectedAlert(null); setShowHospitals(false); setAlertSent(false); }}
          className="mb-4 text-pink-600 hover:text-pink-700 font-medium flex items-center space-x-1"
        >
          <span>←</span> <span>Back to alerts</span>
        </button>

        <div className={`${config.bg} border-l-4 ${config.border} rounded-r-2xl shadow-xl overflow-hidden`}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start space-x-4">
                <div className={`${config.badge} text-white p-3 rounded-full shadow`}>
                  {config.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedAlert.patientName}</h2>
                  <p className="text-gray-600 mt-1">
                    {selectedAlert.age} years • Week {selectedAlert.gestationalWeek}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{formatTime(selectedAlert.timestamp)}</span>
                  </div>
                </div>
              </div>
              <span className={`${config.badge} text-white px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider shadow`}>
                {selectedAlert.priority}
              </span>
            </div>

            {/* Risk Type & Symptoms */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                Risk: {selectedAlert.riskType}
              </h3>
              <p className="font-semibold text-gray-700 mb-2 text-sm">Reported Symptoms:</p>
              <ul className="space-y-1.5">
                {selectedAlert.symptoms.map((symptom, index) => (
                  <li key={index} className="flex items-center space-x-2 text-gray-700 text-sm">
                    <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Patient Location + Map */}
            {selectedAlert.location && (
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-pink-500" />
                  Patient Location
                </h3>
                <p className="text-gray-700 mb-2 text-sm">{selectedAlert.location.address}</p>
                {selectedAlert.location.eta && (
                  <div className="flex items-center space-x-2 text-sm text-green-700 mb-3 font-medium">
                    <Navigation className="w-4 h-4" />
                    <span>Ambulance ETA: {selectedAlert.location.eta}</span>
                  </div>
                )}
                {/* OpenStreetMap embed */}
                <div className="rounded-lg overflow-hidden border border-gray-200 h-48">
                  <iframe
                    title="Patient Location Map"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedAlert.location.coordinates.lng - 0.05},${selectedAlert.location.coordinates.lat - 0.05},${selectedAlert.location.coordinates.lng + 0.05},${selectedAlert.location.coordinates.lat + 0.05}&layer=mapnik&marker=${selectedAlert.location.coordinates.lat},${selectedAlert.location.coordinates.lng}`}
                    style={{ border: 0 }}
                  />
                </div>
              </div>
            )}

            {/* Nearby Hospitals (shown after "Send Alert") */}
            {showHospitals && (
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-3 flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  Nearby Verified Hospitals
                </h3>
                <div className="space-y-2">
                  {NEARBY_HOSPITALS.map((hospital, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{hospital.name}</p>
                        <p className="text-xs text-gray-500">{hospital.address}</p>
                        <p className="text-xs text-blue-600 font-medium mt-0.5">{hospital.distance} away</p>
                      </div>
                      <a
                        href={`tel:${hospital.phone}`}
                        className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                      >
                        Call
                      </a>
                    </div>
                  ))}
                </div>
                {alertSent && (
                  <div className="mt-3 bg-green-100 rounded-lg p-3 flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <p className="text-green-700 text-sm font-medium">Alert & directions sent to patient's phone</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Call Alert Simulator */}
              <button
                onClick={handleCallSimulator}
                disabled={callSimulatorActive}
                id="call-alert-simulator"
                className={`flex-1 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all ${callSimulatorActive
                  ? 'bg-purple-400 cursor-wait'
                  : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                <Volume2 className={`w-5 h-5 ${callSimulatorActive ? 'animate-pulse' : ''}`} />
                <span>{callSimulatorActive ? 'Calling Patient...' : '🔊 Simulate Nurse Call'}</span>
              </button>

              <button
                onClick={handleSendAlertAndDirections}
                id="send-alert-directions"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Navigation className="w-5 h-5" />
                <span>Send Alert & Directions</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <button
                onClick={() => window.open(`tel:${selectedAlert.patientId}`)}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Phone className="w-5 h-5" />
                <span>Call Patient</span>
              </button>

              {selectedAlert.status === 'pending' && (
                <button
                  onClick={() => {
                    if (onAcknowledge) onAcknowledge(selectedAlert.id);
                    setSelectedAlert({ ...selectedAlert, status: 'acknowledged' });
                  }}
                  id="acknowledge-alert-btn"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  <span>Acknowledge</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (onDismiss) onDismiss(selectedAlert.id);
                  setSelectedAlert(null);
                  setShowHospitals(false);
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <X className="w-5 h-5" />
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hospital Emergency Dashboard</h1>
            <p className="text-pink-100 mt-1 text-sm">{hospitalName}</p>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer bg-white/10 rounded-xl px-3 py-2">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="form-checkbox h-4 w-4 text-white"
            />
            <span className="text-sm">Alert Sound</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-orange-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Alerts</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{pendingAlerts.length}</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Critical</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {pendingAlerts.filter(a => a.priority === 'critical').length}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">In Progress</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{acknowledgedAlerts.length}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {pendingAlerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <span>Pending Alerts</span>
            {pendingAlerts.some(a => a.priority === 'critical') && (
              <span className="inline-flex items-center bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                CRITICAL ACTIVE
              </span>
            )}
          </h2>
          <div className="space-y-4">
            {pendingAlerts.map((alert) => {
              const config = getPriorityConfig(alert.priority);
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`${config.bg} border-l-4 ${config.border} rounded-r-xl p-4 cursor-pointer hover:shadow-lg transition-all hover:translate-y-[-1px]`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`${config.badge} text-white p-2 rounded-full shadow`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-gray-800">{alert.patientName}</h3>
                          <span className={`${config.badge} text-white px-2 py-0.5 rounded text-xs font-bold uppercase`}>
                            {alert.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {alert.age} yrs • Week {alert.gestationalWeek} • {alert.riskType}
                        </p>
                        <p className="text-sm text-gray-700 font-medium mb-2">
                          {alert.symptoms.slice(0, 2).join(', ')}
                          {alert.symptoms.length > 2 && ` +${alert.symptoms.length - 2} more`}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(alert.timestamp)}</span>
                          </span>
                          {alert.location && (
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{alert.location.eta || 'Location available'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {acknowledgedAlerts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">In Progress</h2>
          <div className="space-y-3">
            {acknowledgedAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className="bg-white border border-green-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <div>
                      <h3 className="font-bold text-gray-800">{alert.patientName}</h3>
                      <p className="text-sm text-gray-600">{alert.riskType}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{formatTime(alert.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active Alerts</h3>
          <p className="text-gray-600">All patients are being monitored. New alerts will appear here.</p>
        </div>
      )}
    </div>
  );
};
