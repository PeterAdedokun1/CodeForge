import { useState, useEffect } from 'react';
import { CHEWDashboard } from '../components/CHEWDashboard';
import { useDemoData } from '../hooks/useDemoData';
import { getLivePatientAlerts, LivePatientAlert } from '../lib/memoryStore';
import { Patient } from '../components/CHEWDashboard';

export const CHEWPage = () => {
  const { chewPatients } = useDemoData();
  const [mergedPatients, setMergedPatients] = useState<Patient[]>(chewPatients);

  useEffect(() => {
    // Merge live patient alerts from MIMI conversations into the dashboard
    const mergeLiveAlerts = () => {
      const liveAlerts: LivePatientAlert[] = getLivePatientAlerts();

      // Convert live alerts to Patient format
      const livePatients: Patient[] = liveAlerts.map((alert) => ({
        id: alert.patientId,
        name: alert.patientName,
        age: 25, // Default since we may not have it
        gestationalWeek: 28,
        riskLevel: alert.riskLevel === 'critical' ? 'high' : alert.riskLevel === 'low' ? 'low' : alert.riskLevel as 'low' | 'medium' | 'high',
        lastConversation: new Date(alert.timestamp).toLocaleString(),
        pendingActions: alert.riskLevel === 'high' || alert.riskLevel === 'critical' ? 3 : 1,
        location: alert.location || 'Location not set',
        phone: 'Not provided',
        riskHistory: [
          { date: 'Today', score: alert.riskScore }
        ],
        recentSymptoms: alert.symptoms
      }));

      // Merge: live patients take priority over demo data (by ID)
      const livePatientIds = new Set(livePatients.map(p => p.id));
      const filteredDemo = chewPatients.filter(p => !livePatientIds.has(p.id));

      // Sort: high risk first, then by name
      const all = [...livePatients, ...filteredDemo].sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return (riskOrder[a.riskLevel] - riskOrder[b.riskLevel]) || a.name.localeCompare(b.name);
      });

      setMergedPatients(all);
    };

    mergeLiveAlerts();
    // Poll for new alerts every 5 seconds (to catch real-time updates)
    const interval = setInterval(mergeLiveAlerts, 5000);
    return () => clearInterval(interval);
  }, [chewPatients]);

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-pink-50 to-purple-50">
      <CHEWDashboard
        patients={mergedPatients}
        chewName="Nurse Adaeze Nwankwo"
      />
    </div>
  );
};
