# Initial Project Ideas

This document records the early project ideas being considered for the third semester project.

## Shortlisted Ideas

| Idea | Short Description |
| --- | --- |
| Smart Schedule | Staff rota and availability management system for small hospitality businesses. |
| Hospitality Training Portal | Training and onboarding platform for new hospitality staff. |
| Web Accessibility and Quality Auditor | Web app that checks websites for issues such as broken links, missing alt text, and basic accessibility problems. |

## 1. Project Idea Review

### 1.1 Smart Schedule

Smart Schedule is a web-based rota and staff availability management system for small hospitality businesses. It would allow managers to manage staff records, collect availability, handle leave requests and create weekly staff schedules.

#### Problem Being Solved

Small hospitality businesses often manage rotas using spreadsheets, WhatsApp messages, paper notes or informal conversations. This can lead to mistakes such as missed availability, forgotten leave requests, unclear shift swaps and poor visibility for staff.

#### Main Users

1. Managers
2. Supervisors
3. Staff members

#### Possible Core Features

1. Staff management
2. Availability submission
3. Leave request submission
4. Manager approval or rejection of requests
5. Weekly rota view
6. Shift assignment
7. Basic dashboard for managers

#### Possible Technologies

1. React or similar frontend framework
2. Node.js / Express backend
3. PostgreSQL or MySQL database
4. Authentication system
5. GitHub for source control
6. Trello for project management evidence

#### Strengths

The problem is realistic, the users are easy to define, and the requirements can be explained clearly. It also provides strong database design opportunities because the system would need staff, shifts, availability records, leave requests and user roles.

#### New Technology I Could Include

AI could be used later to suggest a draft rota based on staff availability and approved leave. For the first version, I would keep this simple and focus on the main rota system first.

#### My Interest Level

9/10. This is the idea I am most interested in because it connects directly to my hospitality experience.

#### How Realistic It Is In 12 Weeks

8/10. It is realistic if I keep the first version focused on staff records, availability, leave requests, and weekly rota creation.

### 1.2 Hospitality Training Portal

The Hospitality Training Portal would be a web-based system for onboarding and training new hospitality staff. Managers could create training modules, assign them to employees and track completion.

#### Problem Being Solved

Hospitality staff often receive inconsistent training, especially in smaller businesses where formal training systems may not exist. New employees may receive verbal instructions from different people, causing inconsistent service standards and repeated manager involvement.

#### Main Users

1. Managers
2. New employees
3. Supervisors

#### Possible Core Features

1. Training module creation
2. Employee training dashboard
3. Quizzes
4. Progress tracking
5. Completion records
6. Basic certificate or completion status

#### Possible Technologies

1. React or similar frontend framework
2. Node.js / Express backend
3. Relational database
4. Authentication system
5. Optional AI-generated quiz support

#### Strengths

This idea is feasible and has clear users. It could be demonstrated easily using sample training content and quiz results. It also has a strong link to hospitality experience.

#### New Technology I Could Include

AI could help generate short quiz questions from training material. This would save managers time when creating basic staff training content.

#### My Interest Level

8/10. I like this idea because training is a real issue in hospitality, especially when new staff are learning from different people.

#### How Realistic It Is In 12 Weeks

8/10. This is achievable because the main features are clear: training modules, quizzes, progress tracking, and completion records.

### 1.3 Web Accessibility and Quality Auditor

Web Accessibility and Quality Auditor would allow users to enter a website URL and receive a report showing issues such as missing alt text, broken links, poor semantic structure and possible accessibility problems.

#### Problem Being Solved

Many small websites contain basic quality and accessibility problems. These can affect users with disabilities, reduce usability and create a poor user experience. Students and small business owners may not know how to identify these issues manually.

#### Main Users

1. Students
2. Developers
3. Small business owners
4. Website maintainers

#### Possible Core Features

1. URL input and scanning
2. Broken link checking
3. Missing alt text detection
4. Basic accessibility checks
5. Quality scoring
6. Report generation
7. AI-assisted improvement suggestions

#### Possible Technologies

1. React or similar frontend framework
2. Node.js / Express backend
3. Web scraping or crawling libraries
4. Accessibility checking libraries
5. Database for storing scan history
6. Report generation tools

#### Strengths

This idea is technically interesting and has good demonstration potential. It could show real scanning, reports, scoring and recommendations. It also has strong links to software quality, web development and accessibility.

#### New Technology I Could Include

AI could be used to suggest simple fixes for issues found during a website scan, such as missing image descriptions or unclear page structure.

#### My Interest Level

7/10. I find this idea interesting from a web development point of view, but I have less personal experience with this problem compared with the hospitality ideas.

#### How Realistic It Is In 12 Weeks

6/10. It is possible, but riskier because scanning websites can be unpredictable. Some websites may block automated checks or behave differently depending on how they are built.

## 2. Preferred Idea

### Smart Schedule: A Staff Rota and Availability Management System for Small Hospitality Businesses

This project offers the best balance between real-world value, technical depth, feasibility and personal experience. It can be kept within a manageable scope while still demonstrating strong software development skills.

The system would focus on a small set of core features rather than trying to replace a full workforce management platform. This makes it suitable for the project timeline while still allowing enough complexity for database design, role-based access, scheduling logic, testing and evaluation.

## 3. Planned Scope

### 3.1 First Version

1. Staff account management
2. Staff availability submission
3. Leave request submission
4. Manager approval or rejection of requests
5. Weekly rota creation and viewing

### 3.2 Optional Future Enhancements

1. Shift swap requests
2. Email notifications
3. Labour cost estimates
4. AI-assisted rota suggestions
5. Mobile app version
6. Payroll export

### 3.3 Technology Stack

| Area | Early Consideration |
| --- | --- |
| Frontend | React |
| Backend | Node.js with Express |
| Database | PostgreSQL or MySQL |
| Authentication | Session-based or JWT-based login |
| Project Management | Trello |
| Source Control | GitHub |

This stack would allow the project to demonstrate both frontend and backend development. A relational database is appropriate because the system depends on structured relationships between staff, shifts, availability records and leave requests.

## 4. Comparison

| Idea | Feasibility | Technical Depth | Personal Experience | Risk | Final Suitability |
| --- | --- | --- | --- | --- | --- |
| Smart Schedule | High | High | High | Medium | Very High |
| Training Portal | High | Medium | High | Low | Medium |
| Web Auditor | Medium | High | Medium | High | Medium |

## 5. Note On Later Changes

This document records the initial idea selection stage. Technology, scope and implementation details will be refined in later planning documents.
