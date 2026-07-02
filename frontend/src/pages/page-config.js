window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.pageConfig = {
  pages: [
    {
      id: 'rota',
      label: 'Rota',
      audience: 'both',
      eyebrow: 'Rota',
      title: 'Weekly rota',
      summary: 'Check whether the week is covered without opening separate lists.',
      context: 'Managers can edit from cell menus. Staff can view the same rota with read-only actions.',
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
      summary: 'Start with the jobs that affect the next rota.',
      context: 'The rota is the main screen. This page stays as a short support view.',
      metrics: [
        { label: 'Open shifts', value: '3', tone: 'accent' },
        { label: 'Pending leave', value: '2', tone: 'neutral' },
        { label: 'Availability gaps', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          title: 'This week',
          controls: [
            { type: 'date', label: 'Week start', value: '2026-06-08' },
            { type: 'button', label: 'Open rota', tone: 'primary', targetPage: 'rota' },
            { type: 'button', label: 'Create shift', tone: 'secondary', targetPage: 'shifts' }
          ]
        }
      ]
    },
    {
      id: 'login',
      label: 'Login',
      audience: 'both',
      eyebrow: 'Access',
      title: 'Sign in',
      summary: 'Use a work account to open the right tools.',
      context: 'Managers and staff see different actions after login.',
      compactIntro: true,
      metrics: [
        { label: 'Action', value: 'Sign in', tone: 'accent' },
        { label: 'Session', value: 'Secure access', tone: 'neutral' },
        { label: 'Roles', value: 'Manager / Staff', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'form',
          spanClass: 'content-panel--span-10',
          title: 'Account access',
          caption: 'Use your work account to continue.',
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
          title: 'Access rules',
          caption: 'Role-based access stays controlled after login.',
          items: [
            'Managers reach admin and planning tools',
            'Staff reach personal work information',
            'Invalid credentials return a clear error',
            'Protected pages stay restricted'
          ]
        }
      ]
    },
    {
      id: 'staff',
      label: 'Staff Records',
      audience: 'manager',
      eyebrow: 'Team',
      title: 'Staff records',
      summary: 'Add people before they appear in shifts and assignment checks.',
      context: 'Managers keep the team list, role, hours, and active status up to date.',
      compactIntro: true,
      metrics: [
        { label: 'Owner', value: 'Manager', tone: 'accent' },
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
          caption: 'Current staff available for rota planning.',
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
      id: 'availability',
      label: 'Availability',
      audience: 'both',
      eyebrow: 'Availability',
      title: 'When can staff work?',
      summary: 'Staff add times they can or cannot work for the selected week.',
      context: 'Managers review team coverage. Staff only change their own availability.',
      compactIntro: true,
      metrics: [
        { label: 'Week start', value: 'Monday', tone: 'accent' },
        { label: 'Submitted', value: '9 / 12 staff', tone: 'neutral' },
        { label: 'Coverage gaps', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          controls: [
            { type: 'date', label: 'Week start', value: '2026-06-08' },
            { type: 'select', label: 'View', value: 'Team coverage', options: ['Team coverage', 'Own entries'] },
            { type: 'select', label: 'Status', value: 'All entries', options: ['All entries', 'Available only', 'Unavailable only'] },
            { type: 'button', label: 'Add availability', tone: 'primary' }
          ]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Week entries',
          caption: 'Current availability for the selected week.',
          columns: ['Day', 'Time window', 'Status', 'Updated'],
          rows: [
            ['Mon 08 Jun', '09:00 - 17:00', { text: 'Available', tag: 'success' }, 'Today'],
            ['Tue 09 Jun', 'Unavailable', { text: 'Unavailable', tag: 'warning' }, 'Today'],
            ['Wed 10 Jun', '12:00 - 20:00', { text: 'Available', tag: 'success' }, 'Yesterday']
          ]
        },
        {
          type: 'form',
          spanClass: 'content-panel--span-5',
          title: 'Availability entry',
          caption: 'Add or edit one time window.',
          fields: [
            { label: 'Day', type: 'select', value: 'Monday', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], spanClass: 'form-field--span-12' },
            { label: 'Start time', type: 'time', value: '09:00', spanClass: 'form-field--span-6' },
            { label: 'End time', type: 'time', value: '17:00', spanClass: 'form-field--span-6' },
            { label: 'Status', type: 'select', value: 'Available', options: ['Available', 'Unavailable'], spanClass: 'form-field--span-12' }
          ],
          actions: [
            { label: 'Save entry', tone: 'primary' },
            { label: 'Clear', tone: 'ghost' }
          ]
        }
      ]
    },
    {
      id: 'leave',
      label: 'Leave Requests',
      audience: 'both',
      eyebrow: 'Leave',
      title: 'Leave requests',
      summary: 'Staff ask for leave and managers decide what is approved.',
      context: 'A request stays waiting until a manager approves or rejects it.',
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
            { type: 'button', label: 'New request', tone: 'primary' }
          ]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Recent requests',
          caption: 'Track request status by date and outcome.',
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
          title: 'New request',
          caption: 'Submit a leave request for review.',
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
    {
      id: 'shifts',
      label: 'Build Shifts',
      audience: 'manager',
      eyebrow: 'Shifts',
      title: 'Shift planning',
      summary: 'Create the shift times before assigning staff.',
      context: 'Managers set date, time, role, and status. Assignment comes after that.',
      compactIntro: true,
      metrics: [
        { label: 'Draft shifts', value: '8', tone: 'accent' },
        { label: 'Open roles', value: '3', tone: 'neutral' },
        { label: 'Late coverage', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          controls: [
            { type: 'date', label: 'Week start', value: '2026-06-08' },
            { type: 'select', label: 'Role', value: 'All roles', options: ['All roles', 'Floor', 'Bar', 'Kitchen', 'Other'] },
            { type: 'button', label: 'Create shift', tone: 'primary' }
          ]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Shift list',
          caption: 'Current shifts for the selected week.',
          columns: ['Date', 'Time', 'Role', 'Status'],
          rows: [
            ['Fri 12 Jun', '14:00 - 22:00', 'Bar', { text: 'Open', tag: 'info' }],
            ['Sat 13 Jun', '09:00 - 17:00', 'Floor', { text: 'Assigned', tag: 'success' }],
            ['Sun 14 Jun', '12:00 - 20:00', 'Kitchen', { text: 'Draft', tag: 'muted' }]
          ]
        },
        {
          type: 'form',
          spanClass: 'content-panel--span-5',
          title: 'Create shift',
          caption: 'Add one shift to the current week.',
          fields: [
            { label: 'Shift date', type: 'date', value: '2026-06-12', spanClass: 'form-field--span-12' },
            { label: 'Start time', type: 'time', value: '14:00', spanClass: 'form-field--span-6' },
            { label: 'End time', type: 'time', value: '22:00', spanClass: 'form-field--span-6' },
            { label: 'Required role', type: 'select', value: 'Bar', options: ['Floor', 'Bar', 'Kitchen', 'Other'], spanClass: 'form-field--span-12' },
            { label: 'Notes', type: 'textarea', value: 'Busy Friday service', spanClass: 'form-field--span-12', rows: 4 }
          ],
          actions: [
            { label: 'Save shift', tone: 'primary' },
            { label: 'Reset', tone: 'ghost' }
          ]
        }
      ]
    },
    {
      id: 'assignments',
      label: 'Assign Staff',
      audience: 'manager',
      eyebrow: 'Assignments',
      title: 'Assign staff',
      summary: 'Review one shift and check who looks suitable.',
      context: 'This is still a review screen. The full backend conflict engine comes after this checkpoint.',
      compactIntro: true,
      metrics: [
        { label: 'Selected shift', value: 'Fri 12 Jun', tone: 'accent' },
        { label: 'Candidates', value: '4', tone: 'neutral' },
        { label: 'Blocked', value: '1', tone: 'neutral' }
      ],
      blocks: [
        {
          type: 'toolbar',
          controls: [
            { type: 'date', label: 'Week start', value: '2026-06-08' },
            { type: 'select', label: 'Shift', value: 'Fri 12 Jun - 14:00 to 22:00', options: ['Fri 12 Jun - 14:00 to 22:00', 'Sat 13 Jun - 09:00 to 17:00'] },
            { type: 'button', label: 'Review shift', tone: 'primary' }
          ]
        },
        {
          type: 'form',
          spanClass: 'content-panel--span-5',
          title: 'Selected shift',
          caption: 'Current assignment target.',
          fields: [
            { label: 'Date', type: 'date', value: '2026-06-12', spanClass: 'form-field--span-12', readonly: true },
            { label: 'Start time', type: 'time', value: '14:00', spanClass: 'form-field--span-6', readonly: true },
            { label: 'End time', type: 'time', value: '22:00', spanClass: 'form-field--span-6', readonly: true },
            { label: 'Required role', type: 'text', value: 'Bar', spanClass: 'form-field--span-12', readonly: true }
          ],
          actions: [{ label: 'Assign selected staff', tone: 'primary' }]
        },
        {
          type: 'table',
          spanClass: 'content-panel--span-11',
          title: 'Available staff',
          caption: 'Candidate list for the selected shift.',
          columns: ['Name', 'Role', 'Availability', 'Warnings'],
          rows: [
            ['Maya Quinn', 'Bar', { text: 'Available', tag: 'success' }, { text: 'None', subtle: true }],
            ['Alex Byrne', 'Floor', { text: 'Role mismatch', tag: 'warning' }, { text: 'Role conflict', subtle: true }],
            ['Jamie Fox', 'Bar', { text: 'Available', tag: 'success' }, { text: '32 / 35 hrs', subtle: true }]
          ]
        },
        {
          type: 'list',
          spanClass: 'content-panel--span-16',
          title: 'Conflict checks',
          caption: 'Applied before an assignment is confirmed.',
          items: [
            'Approved leave conflict',
            'Overlapping shift conflict',
            'Availability conflict',
            'Role mismatch conflict',
            'Contract-hours warning'
          ]
        }
      ]
    },
  ]
};
