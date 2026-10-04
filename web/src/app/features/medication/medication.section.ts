import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Medication section (spec 09): one kind, so + opens the Medication sheet directly. Its components are
 * loaded on demand, keeping them out of the initial bundle.
 */
export const MEDICATION_SECTION: SectionDefinition = {
  key: 'medication',
  icon: 'medication',
  loadCard: () =>
    import('./medication-card/medication-card.component').then((m) => m.MedicationCardComponent),
  kinds: [
    {
      key: 'medication',
      icon: 'medication',
      label: 'medication.kinds.medication',
      loadSheet: () =>
        import('./medication-sheet/medication-sheet.component').then(
          (m) => m.MedicationSheetComponent,
        ),
    },
  ],
  loadHistory: () =>
    import('./medication-history/medication-history.component').then(
      (m) => m.MedicationHistoryComponent,
    ),
};
