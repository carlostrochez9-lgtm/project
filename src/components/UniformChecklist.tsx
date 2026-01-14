import { CheckCircle } from 'lucide-react';

interface UniformChecklistProps {
  requirements: string | null;
  eventTitle: string;
  dressCode: string;
}

export function UniformChecklist({ requirements, eventTitle, dressCode }: UniformChecklistProps) {
  const getDefaultRequirements = (dressCode: string): string[] => {
    const baseRequirements = [
      'Arrive 30 minutes before shift start',
      'Hair neatly styled and secured',
      'Minimal jewelry - wedding band and watch only',
      'Fresh breath - no smoking before shift',
      'Clean, pressed uniform',
    ];

    if (dressCode.toLowerCase().includes('black tie')) {
      return [
        ...baseRequirements,
        'Black tuxedo with satin lapels',
        'Crisp white dress shirt',
        'Black bow tie (pre-tied acceptable)',
        'Black patent leather shoes - polished',
        'Black dress socks',
      ];
    } else if (dressCode.toLowerCase().includes('white glove')) {
      return [
        ...baseRequirements,
        'Formal black tuxedo',
        'White cotton gloves - pressed and spotless',
        'Black patent leather shoes - mirror shine',
        'White wing collar shirt with studs',
        'Pocket square - white, presidential fold',
      ];
    }

    return [
      ...baseRequirements,
      'Professional business attire',
      'Polished dress shoes',
      'Conservative tie',
    ];
  };

  const customRequirements = requirements ? requirements.split('\n').filter(r => r.trim()) : null;
  const checklistItems = customRequirements || getDefaultRequirements(dressCode);

  return (
    <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/40 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-xl font-serif text-white mb-1">Digital Uniform Checklist</h3>
        <p className="text-sm text-gray-400">{eventTitle}</p>
      </div>

      <div className="space-y-3">
        {checklistItems.map((item, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded border-2 border-[#D4AF37]/50 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-[#D4AF37]/30" />
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg">
        <p className="text-sm text-[#D4AF37] font-medium">
          Please ensure all items are checked before your arrival. Failure to meet dress code standards may result in shift reassignment.
        </p>
      </div>
    </div>
  );
}
