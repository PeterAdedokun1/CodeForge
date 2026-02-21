import { useState } from 'react';
import { VoiceInterface } from '../components/VoiceInterface';
import { RiskAssessment } from '../lib/riskEngine';
import { AlertTriangle, Activity } from 'lucide-react';

export const HomePage = () => {
  const [latestRisk, setLatestRisk] = useState<RiskAssessment | null>(null);

  return (
    <div className="h-full flex flex-col">
      <VoiceInterface onRiskUpdate={setLatestRisk} />

      {/* Floating risk alert (for high/critical risk) */}
      {latestRisk && latestRisk.requiresAlert && (
        <div className="fixed bottom-32 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50">
          <div className={`rounded-2xl shadow-2xl p-4 border-l-4 ${latestRisk.level === 'critical'
              ? 'bg-red-50 border-red-500'
              : 'bg-orange-50 border-orange-500'
            }`}>
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-full ${latestRisk.level === 'critical' ? 'bg-red-100' : 'bg-orange-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${latestRisk.level === 'critical' ? 'text-red-600 animate-pulse' : 'text-orange-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${latestRisk.level === 'critical' ? 'text-red-800' : 'text-orange-800'}`}>
                  {latestRisk.level === 'critical' ? '🚨 Urgent: Please go to hospital now' : '⚠️ Please see a health worker today'}
                </p>
                <p className={`text-xs mt-1 ${latestRisk.level === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                  {latestRisk.recommendation}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-500">Your CHEW worker has been notified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
