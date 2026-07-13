window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.pageConfig = {
  pages: [
    {
      id: 'rota',
      label: 'Rota',
      audience: 'both',
      hideIntro: true,
      eyebrow: 'Rota',
      title: 'Weekly rota',
      summary: 'Check the week quickly.',
      context: 'Managers change names and times here. Staff can check the full weekly roster.',
      compactIntro: true,
      metrics: [
        { label: 'Main screen', value: 'Rota', tone: 'accent' },
        { label: 'View', value: 'Week', tone: 'neutral' },
        { label: 'Departments', value: '4', tone: 'neutral' }
      ],
      blocks: []
    },
    {
      id: 'overview',
      label: 'Overview',
      audience: 'both',
      eyebrow: 'This week',
      title: 'What needs doing',
      summary: 'Open the rota first. Time off is next.',
      context: 'The rota is the first place to check after sign in.',
      metrics: [
        { label: 'Open shifts', value: '3', tone: 'accent' },
        { label: 'Time off waiting', value: '2', tone: 'neutral' },
        { label: 'Active staff', value: '12', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          title: 'This week',
          controls: [
            { type: 'date', label: 'Week start', value: '2026-06-08' },
            { type: 'button', label: 'Open rota', tone: 'primary', targetPage: 'rota' },
            { type: 'button', label: 'Open time off', tone: 'secondary', targetPage: 'leave' }
          ]
        }
      ]
    },
    {
      id: 'login',
      label: 'Login',
      audience: 'both',
      eyebrow: 'Sign in',
      title: 'Sign in',
      summary: 'Use your work email and password.',
      context: 'Managers and staff see different pages after login.',
      compactIntro: true,
      metrics: [
        { label: 'Action', value: 'Sign in', tone: 'accent' },
        { label: 'Session', value: 'Work account', tone: 'neutral' },
        { label: 'Pages', value: 'By role', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'form',
          spanClass: 'content-panel--span-10',
          title: 'Work account',
          caption: 'Enter the account given by the manager.',
          fields: [
            { label: 'Email address', type: 'email', value: '', spanClass: 'form-field--span-12' },
            { label: 'Password', type: 'password', value: '', spanClass: 'form-field--span-12' }
          ],
          actions: [
            { label: 'Sign in', tone: 'primary' },
            { label: 'Forgot password', tone: 'ghost' }
          ]
        },
        {
          type: 'list',
          spanClass: 'content-panel--span-6',
          title: 'After sign in',
          caption: 'The app opens the pages your account is allowed to use.',
          items: [
            'Managers can add staff and build the rota',
            'Staff can check the full rota and time off',
            'The app does not save your password in the browser',
            'Sign out when you finish on a shared computer'
          ]
        }
      ]
    },
    {
      id: 'staff',
      label: 'Staff',
      audience: 'manager',
      eyebrow: 'Team',
      title: 'Staff',
      summary: 'Add staff here before putting them on the rota.',
      context: 'Managers keep the team list, role, hours, and active status up to date.',
      compactIntro: true,
      metrics: [
        { label: 'Your role', value: 'Manager', tone: 'accent' },
        { label: 'Active staff', value: '12', tone: 'neutral' },
        { label: 'Unassigned roles', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          controls: [
            { type: 'search', label: 'Search staff', value: 'Alex Byrne' },
            { type: 'select', label: 'Role', value: 'All roles', options: ['All roles', 'Floor', 'Bar', 'Kitchen', 'Other'] },
            { type: 'select', label: 'Status', value: 'Active only', options: ['Active only', 'All staff', 'Inactive only'] },
            { type: 'button', label: 'Add staff', tone: 'primary' }
          ]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Team list',
          caption: 'People the manager can put on shifts.',
          columns: ['Name', 'Role', 'Contract hours', 'Status'],
          rows: [
            ['Alex Byrne', 'Floor', '25 hrs', { text: 'Active', tag: 'success' }],
            ['Maya Quinn', 'Bar', '32 hrs', { text: 'Active', tag: 'success' }],
            ['Sam Doyle', 'Kitchen', '20 hrs', { text: 'Inactive', tag: 'muted' }]
          ]
        },
        {
          type: 'form',
          spanClass: 'content-panel--span-5',
          title: 'Selected staff profile',
          caption: 'Update core details before scheduling.',
          fields: [
            { label: 'Full name', type: 'text', value: 'Alex Byrne', spanClass: 'form-field--span-12' },
            { label: 'Primary role', type: 'select', value: 'Floor', options: ['Floor', 'Bar', 'Kitchen', 'Other'], spanClass: 'form-field--span-6' },
            { label: 'Contract hours', type: 'number', value: '25', spanClass: 'form-field--span-6' },
            { label: 'Phone number', type: 'tel', value: '0850000000', spanClass: 'form-field--span-12' },
            { label: 'Status', type: 'select', value: 'Active', options: ['Active', 'Inactive'], spanClass: 'form-field--span-12' }
          ],
          actions: [
            { label: 'Save changes', tone: 'primary' },
            { label: 'Deactivate', tone: 'secondary' }
          ]
        }
      ]
    },
    {
      id: 'leave',
      label: 'Time Off',
      audience: 'both',
      eyebrow: 'Time off',
      title: 'Time off',
      summary: 'Ask for time off and check if it was approved.',
      context: 'A request waits until a manager approves or rejects it.',
      compactIntro: true,
      metrics: [
        { label: 'Pending', value: '2', tone: 'accent' },
        { label: 'Approved this week', value: '4', tone: 'neutral' },
        { label: 'Rejected this week', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          controls: [
            { type: 'select', label: 'Status', value: 'All requests', options: ['All requests', 'Pending', 'Approved', 'Rejected'] },
            { type: 'date', label: 'From', value: '2026-06-01' },
            { type: 'date', label: 'To', value: '2026-06-30' },
            { type: 'button', label: 'Ask for time off', tone: 'primary' }
          ]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Requests',
          caption: 'Dates, reason, and decision.',
          columns: ['Request', 'Dates', 'Reason', 'Status'],
          rows: [
            ['Alex Byrne', '10 Jun - 12 Jun', 'Annual leave', { text: 'Pending', tag: 'warning' }],
            ['Maya Quinn', '17 Jun - 17 Jun', 'Medical', { text: 'Approved', tag: 'success' }],
            ['Sam Doyle', '21 Jun - 22 Jun', 'Personal', { text: 'Rejected', tag: 'muted' }]
          ]
        },
        {
          type: 'form',
          spanClass: 'content-panel--span-5',
          title: 'Ask for time off',
          caption: 'Choose the dates and add a short reason.',
          fields: [
            { label: 'Start date', type: 'date', value: '2026-06-21', spanClass: 'form-field--span-6' },
            { label: 'End date', type: 'date', value: '2026-06-22', spanClass: 'form-field--span-6' },
            { label: 'Reason', type: 'textarea', value: 'Annual leave', spanClass: 'form-field--span-12', rows: 4 }
          ],
          actions: [
            { label: 'Submit request', tone: 'primary' },
            { label: 'Cancel', tone: 'ghost' }
          ]
        }
      ]
    },
  ]
};
