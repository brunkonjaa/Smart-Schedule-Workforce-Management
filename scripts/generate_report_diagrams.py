from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "report" / "diagrams"
OUTPUT.mkdir(parents=True, exist_ok=True)

INK = "#16343B"
TEAL = "#0F6070"
MID = "#2F8792"
PALE = "#DCEFF0"
SAND = "#F4E4C1"
RED = "#A7443E"
GREEN = "#3C7A57"
WHITE = "#FFFFFF"
GREY = "#62777C"


def svg_start(width, height, title):
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#16343B"/></marker></defs>',
        f'<rect width="{width}" height="{height}" fill="{WHITE}"/>',
        f'<text x="60" y="66" font-family="Arial" font-size="34" font-weight="700" fill="{INK}">{escape(title)}</text>',
        f'<line x1="60" y1="82" x2="{width - 60}" y2="82" stroke="{MID}" stroke-width="4"/>'
    ]


def text(lines, x, y, size=22, colour=INK, weight=400, anchor="start", line_height=None):
    if isinstance(lines, str):
        lines = [lines]
    line_height = line_height or int(size * 1.28)
    spans = []
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else line_height
        spans.append(f'<tspan x="{x}" dy="{dy}">{escape(str(line))}</tspan>')
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Arial" font-size="{size}" font-weight="{weight}" fill="{colour}">' + ''.join(spans) + '</text>'


def box(parts, x, y, width, height, title, lines=(), fill=PALE, stroke=TEAL, title_height=42, font=20):
    parts.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
    parts.append(f'<path d="M {x} {y + title_height} H {x + width}" stroke="{stroke}" stroke-width="2"/>')
    parts.append(text(title, x + 14, y + 29, size=font + 1, colour=INK, weight=700))
    if lines:
        parts.append(text(lines, x + 14, y + title_height + font + 7, size=font, colour=INK, line_height=font + 6))


def rounded(parts, x, y, width, height, label, fill=WHITE, stroke=TEAL, font=19):
    parts.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{height / 2}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
    labels = label if isinstance(label, list) else [label]
    start_y = y + height / 2 - ((len(labels) - 1) * (font + 3) / 2) + 7
    parts.append(text(labels, x + width / 2, start_y, size=font, weight=600, anchor="middle", line_height=font + 3))


def arrow(parts, x1, y1, x2, y2, label=None, dashed=False, colour=INK, width=2.5):
    dash = ' stroke-dasharray="9 7"' if dashed else ''
    parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{colour}" stroke-width="{width}"{dash} marker-end="url(#arrow)"/>')
    if label:
        parts.append(text(label, (x1 + x2) / 2, (y1 + y2) / 2 - 8, size=17, colour=colour, weight=600, anchor="middle"))


def line(parts, x1, y1, x2, y2, colour=GREY, dashed=False, width=2):
    dash = ' stroke-dasharray="8 7"' if dashed else ''
    parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{colour}" stroke-width="{width}"{dash}/>')


def save(name, parts):
    parts.append('</svg>')
    (OUTPUT / name).write_text('\n'.join(parts), encoding='utf-8')


def use_case():
    p = svg_start(1600, 1080, "Smart Schedule final use-case diagram")
    p.append(f'<rect x="360" y="115" width="1160" height="875" rx="20" fill="#F8FBFB" stroke="{MID}" stroke-width="4"/>')
    p.append(text("Smart Schedule", 940, 152, size=24, weight=700, anchor="middle"))

    for x, y, label in [(150, 280, "Manager"), (150, 705, "Staff")]:
        p.append(f'<circle cx="{x}" cy="{y}" r="26" fill="{PALE}" stroke="{TEAL}" stroke-width="4"/>')
        line(p, x, y + 26, x, y + 105, colour=TEAL, width=4)
        line(p, x - 48, y + 55, x + 48, y + 55, colour=TEAL, width=4)
        line(p, x, y + 105, x - 42, y + 160, colour=TEAL, width=4)
        line(p, x, y + 105, x + 42, y + 160, colour=TEAL, width=4)
        p.append(text(label, x, y + 200, size=23, weight=700, anchor="middle"))

    manager_cases = [
        (420, 210, "Manage staff and\naccount state"),
        (760, 210, "Create and edit\nweekly shifts"),
        (1100, 210, "Assign staff and\nreview warnings"),
        (420, 385, "Decide leave and\npassword requests"),
        (760, 385, "Preview and approve\nnext-week rota"),
        (1100, 385, "Approve or reject\naccepted swaps"),
        (760, 560, "Review audit records")
    ]
    staff_cases = [
        (420, 700, "Request and track\ntime off"),
        (760, 700, "Request or accept\nshift swaps"),
        (1100, 700, "View previous-week\nwork history")
    ]
    shared_cases = [
        (420, 860, "Login, logout and\nrecover access"),
        (760, 860, "View full weekly rota\nand own assignments"),
        (1100, 860, "Use NodyChat workplace\nand direct messages")
    ]
    for x, y, label in manager_cases:
        rounded(p, x, y, 290, 105, label.split('\n'))
        arrow(p, 245, 355, x, y + 52, dashed=True, colour=GREY)
    for x, y, label in staff_cases:
        rounded(p, x, y, 290, 105, label.split('\n'), fill=SAND)
        arrow(p, 245, 780, x, y + 52, dashed=True, colour=GREY)
    for x, y, label in shared_cases:
        rounded(p, x, y, 290, 105, label.split('\n'), fill="#E7F0DC", stroke=GREEN)
        arrow(p, 245, 355, x, y + 52, dashed=True, colour=GREY)
        arrow(p, 245, 780, x, y + 52, dashed=True, colour=GREY)
    p.append(text("Product scope is frozen: payroll, SMS/push, POS integration and automatic rota publication are outside this diagram.", 800, 1035, size=18, colour=GREY, anchor="middle"))
    save("01_use_case.svg", p)


def erd_box(p, x, y, title, fields, colour=TEAL, width=350):
    height = 48 + 25 * len(fields) + 18
    box(p, x, y, width, height, title, fields, fill=WHITE, stroke=colour, title_height=44, font=17)
    return height


def erd():
    p = svg_start(2400, 1750, "Smart Schedule live database ERD after migration 022")
    p.append(text("PK = primary key, FK = foreign key, UQ = unique. user_sessions is created by the PostgreSQL session store.", 60, 115, size=20, colour=GREY))
    entities = {
        "users": (60, 150, ["PK id UUID", "UQ email varchar", "password_hash varchar", "role MANAGER|STAFF", "is_active boolean", "must_change_password boolean", "password_changed_at timestamptz?", "created_at, updated_at"]),
        "staff_profiles": (440, 150, ["PK id UUID", "FK/UQ user_id -> users", "full_name varchar", "primary_role varchar", "contract_hours numeric", "phone_number varchar?", "is_active boolean", "created_at, updated_at"]),
        "shifts": (820, 150, ["PK id UUID", "shift_date date", "start_time, end_time", "required_role varchar", "status DRAFT|OPEN|CANCELLED", "notes varchar?", "created_at, updated_at"]),
        "shift_assignments": (1200, 150, ["PK id UUID", "FK/UQ shift_id -> shifts", "FK staff_profile_id -> staff_profiles", "FK assigned_by_user_id -> users", "assigned_at", "created_at, updated_at"]),
        "leave_requests": (1580, 150, ["PK id UUID", "FK staff_profile_id -> staff_profiles", "start_date, end_date", "reason varchar", "status PENDING|APPROVED|REJECTED", "manager_comment?", "FK decided_by_user_id -> users?", "decided_at?", "created_at, updated_at"]),
        "shift_swap_requests": (1960, 150, ["PK id UUID", "FK assignment_id -> shift_assignments", "FK requester_profile_id -> staff_profiles", "FK target_profile_id -> staff_profiles?", "FK accepted_by_profile_id -> staff_profiles?", "status PENDING|ACCEPTED|...", "reason?, manager_note?", "accepted_at?, decided_at?", "FK decided_by_user_id -> users?", "created_at"]),
        "user_passkeys": (60, 565, ["PK id UUID", "FK user_id -> users", "UQ credential_id bytea", "public_key bytea", "counter bigint", "device_name varchar", "transports array", "created_at", "last_used_at?, revoked_at?"]),
        "password_reset_requests": (440, 565, ["PK id UUID", "FK user_id -> users", "UQ token_hash char(64)", "requested_ip inet?", "expires_at", "used_at?", "created_at"]),
        "security_events": (820, 565, ["PK id UUID", "FK actor_user_id -> users?", "FK target_user_id -> users?", "FK staff_profile_id -> staff_profiles?", "event_type text", "outcome SUCCESS|FAILURE", "ip_address?", "metadata jsonb?", "created_at"]),
        "audit_logs": (1200, 565, ["PK id UUID", "FK actor_user_id -> users?", "action varchar", "entity_type ASSIGNMENT|SHIFT", "entity_id UUID", "summary varchar", "before_state jsonb?", "after_state jsonb?", "created_at"]),
        "user_sessions": (1580, 565, ["PK sid varchar", "sess json", "expire timestamp"]),
        "schema_migrations": (1960, 565, ["PK filename varchar", "applied_at timestamptz"]),
        "chat_conversations": (60, 1060, ["PK id UUID", "kind WORKPLACE|DIRECT", "UQ direct_key varchar?", "created_at"]),
        "chat_conversation_participants": (500, 1060, ["PK/FK conversation_id -> conversations", "PK/FK user_id -> users", "joined_at"]),
        "chat_messages": (1040, 1060, ["PK id UUID", "FK conversation_id -> conversations", "FK sender_user_id -> users", "message text (1..1000)", "created_at"]),
        "chat_read_states": (1520, 1060, ["PK/FK user_id -> users", "PK/FK conversation_id -> conversations", "FK last_read_message_id -> messages?", "updated_at"])
    }
    sizes = {}
    for name, (x, y, fields) in entities.items():
        sizes[name] = erd_box(p, x, y, name, fields, colour=TEAL if not name.startswith('chat_') else GREEN, width=350 if name != 'chat_conversation_participants' else 460)

    relationships = [
        (410, 220, 440, 220, "1 : 0..1"),
        (790, 255, 1200, 255, "1 : 0..1"),
        (1170, 330, 1200, 330, "1 : many"),
        (790, 350, 1580, 350, "1 : many"),
        (1550, 300, 1960, 300, "1 : many")
    ]
    for x1, y1, x2, y2, label in relationships:
        arrow(p, x1, y1, x2, y2, label=label, colour=GREY)
    arrow(p, 235, 420, 235, 565, "1 : many", colour=GREY)
    arrow(p, 410, 330, 440, 660, "1 : many", colour=GREY)
    arrow(p, 410, 360, 820, 670, "1 : many", colour=GREY)
    arrow(p, 410, 390, 1200, 670, "1 : many", colour=GREY)
    arrow(p, 410, 410, 1580, 660, "1 : many", colour=GREY)

    arrow(p, 410, 1160, 500, 1160, "1 : many", colour=GREEN)
    arrow(p, 235, 460, 650, 1060, "1 : many", colour=GREEN)
    arrow(p, 410, 1215, 1040, 1215, "1 : many", colour=GREEN)
    arrow(p, 235, 480, 1040, 1270, "1 : many", colour=GREEN)
    arrow(p, 410, 1275, 1520, 1275, "1 : many", colour=GREEN)
    arrow(p, 1390, 1370, 1520, 1370, "1 : many reads", colour=GREEN)
    arrow(p, 235, 500, 1520, 1160, "1 : many", colour=GREEN)

    p.append(f'<rect x="60" y="1540" width="2280" height="120" rx="12" fill="{SAND}" stroke="#B9862E" stroke-width="2"/>')
    p.append(text([
        "Migration chain: 001 users -> 002 staff profiles -> 005 leave -> 006 shifts -> 007 assignments -> 009 audit -> 010-012 security -> 013 swaps -> 018 passkeys -> 020-022 NodyChat.",
        "availability_entries was created in 004 and removed by 014, so it is not a live entity. Payroll, notification and recommendation tables do not exist."
    ], 85, 1583, size=21, line_height=34))
    save("02_complete_erd.svg", p)


def architecture():
    p = svg_start(1700, 1050, "Smart Schedule deployed system architecture")
    box(p, 70, 150, 360, 245, "Client / installable web shell", ["HTML, CSS and plain JavaScript", "Responsive rota and workflow pages", "Web manifest + service worker", "Fetch for REST; WebSocket for NodyChat"], fill="#E7F0DC", stroke=GREEN, font=21)
    box(p, 670, 130, 420, 170, "Render Node.js process", ["Express 4 application", "ws WebSocket server", "Same process and session middleware"], fill=PALE, font=22)
    box(p, 565, 390, 630, 360, "Application layers", ["Helmet CSP and secure headers", "Rate limits + 32 KB JSON limit", "Server-side sessions and mutation header", "Authentication, RBAC and ownership middleware", "Routes -> validation -> services", "Transactions for assignment/swap decisions", "Consistent JSON errors and audit/security records"], fill=WHITE, font=21)
    box(p, 1320, 175, 310, 220, "Neon PostgreSQL", ["Migrations 001-022", "Business and chat records", "connect-pg-simple sessions", "TLS with certificate checks"], fill=SAND, stroke="#B9862E", font=21)
    box(p, 1320, 560, 310, 170, "Brevo email", ["Password-reset delivery only", "Token hash remains in PostgreSQL", "Generic response avoids account lookup"], fill="#F7E6E4", stroke=RED, font=20)
    box(p, 70, 620, 360, 195, "Browser security boundary", ["HTTPS in production", "HttpOnly + SameSite session cookie", "No credentials in localStorage", "Cross-origin WebSocket rejected"], fill="#F7E6E4", stroke=RED, font=20)
    arrow(p, 430, 245, 670, 220, "HTTPS REST")
    arrow(p, 430, 310, 670, 275, "WSS NodyChat")
    arrow(p, 880, 300, 880, 390, "middleware")
    arrow(p, 1195, 520, 1320, 305, "parameterised SQL")
    arrow(p, 1195, 620, 1320, 645, "reset email")
    arrow(p, 250, 620, 670, 520, "session cookie")
    p.append(text("Hosting boundary", 1220, 120, size=19, colour=GREY, weight=700))
    line(p, 1220, 130, 1660, 130, colour=GREY, dashed=True)
    p.append(text("No separate scheduling engine or message broker is claimed. Rota population is a manager-reviewed browser preview and saves through the existing shift/assignment APIs.", 850, 950, size=20, colour=GREY, anchor="middle"))
    save("03_system_architecture.svg", p)


def assignment_sequence():
    p = svg_start(1800, 1200, "Assignment and conflict-check sequence")
    actors = [(150, "Manager UI"), (520, "Assignments route"), (900, "Assignment service"), (1290, "PostgreSQL"), (1630, "Audit log")]
    for x, label in actors:
        rounded(p, x - 120, 120, 240, 58, label, fill=PALE, font=18)
        line(p, x, 178, x, 1110, colour=GREY, dashed=True)
    steps = [
        (150, 520, 235, "POST /assignments + mutation header"),
        (520, 900, 315, "validate UUIDs and exact fields"),
        (900, 1290, 395, "BEGIN SERIALIZABLE; lock shift"),
        (1290, 900, 475, "shift + staff rows"),
        (900, 1290, 555, "check OPEN and active"),
        (900, 1290, 625, "check role, approved leave"),
        (900, 1290, 695, "check overlap or touching shift"),
        (900, 1290, 765, "calculate Monday-Sunday shifts/hours"),
        (1290, 900, 835, "current count + projected hours"),
        (900, 1290, 905, "insert only if <= 5 shifts and <= 40 h"),
        (900, 1630, 975, "write before/after evidence"),
        (900, 520, 1045, "saved assignment + contract warning(s)"),
        (520, 150, 1110, "201 saved, or 409 conflict")
    ]
    for start, end, y, label in steps:
        arrow(p, start, y, end, y, label, dashed=end < start)
    p.append(f'<rect x="1030" y="525" width="570" height="335" rx="12" fill="#FFF7E8" stroke="#B9862E" stroke-width="2"/>')
    p.append(text(["Hard-stop order", "1. shift is OPEN", "2. staff and user are active", "3. required role matches", "4. no approved leave", "5. no overlapping or touching assignment", "6. projected week <= 5 shifts", "7. projected week <= 40 hours"], 1055, 560, size=18, line_height=36, weight=700))
    p.append(text("Contract hours are not a hard stop. If projected hours pass the staff profile contract but stay within 40, the save succeeds and returns a warning.", 900, 1170, size=19, colour=RED, anchor="middle"))
    save("04_assignment_conflict_sequence.svg", p)


def swap_state():
    p = svg_start(1700, 1050, "Shift-swap state and decision flow")
    states = {
        "PENDING": (650, 220, SAND),
        "ACCEPTED": (650, 500, PALE),
        "APPROVED": (1180, 740, "#E7F0DC"),
        "REJECTED": (250, 740, "#F7E6E4"),
        "CANCELLED": (250, 500, "#F0F0F0"),
        "EXPIRED": (1180, 220, "#F0F0F0")
    }
    for name, (x, y, fill) in states.items():
        rounded(p, x, y, 280, 86, name, fill=fill, stroke=GREEN if name == 'APPROVED' else (RED if name == 'REJECTED' else TEAL), font=23)
    rounded(p, 80, 220, 340, 86, "Future owned assignment", fill=WHITE, font=21)
    arrow(p, 420, 263, 650, 263, "requester creates")
    arrow(p, 790, 306, 790, 500, "target or eligible staff accepts")
    arrow(p, 930, 543, 1180, 783, "manager approves")
    arrow(p, 650, 550, 530, 740, "manager rejects")
    arrow(p, 650, 520, 530, 543, "request withdrawn")
    arrow(p, 930, 250, 1180, 250, "future lifecycle rule")
    p.append(f'<rect x="1030" y="455" width="590" height="205" rx="12" fill="{WHITE}" stroke="{GREEN}" stroke-width="3"/>')
    p.append(text(["Approval transaction", "The accepted staff profile is checked again.", "updateAssignment applies role, leave, conflict and weekly limits.", "Only then is shift_assignments.staff_profile_id changed.", "A failed final check leaves the swap unapproved."], 1060, 495, size=20, line_height=34, weight=600))
    p.append(f'<rect x="80" y="365" width="460" height="150" rx="12" fill="{WHITE}" stroke="#B9862E" stroke-width="3"/>')
    p.append(text(["Creation gates", "Owner of assignment; shift after today; OPEN status;", "one PENDING/ACCEPTED request per assignment;", "named target must be active and have the required role."], 105, 405, size=18, line_height=31))
    p.append(text("PENDING and ACCEPTED are the active states returned by the current list route. CANCELLED and EXPIRED exist in the database status rule but have no current transition route.", 850, 970, size=19, colour=GREY, anchor="middle"))
    save("05_shift_swap_state.svg", p)


def chat_flow():
    p = svg_start(1800, 1150, "NodyChat conversation, unread and message flow")
    lanes = [(160, "Signed-in browser"), (560, "HTTP / WebSocket"), (980, "Chat service"), (1430, "PostgreSQL")]
    for x, label in lanes:
        rounded(p, x - 135, 120, 270, 58, label, fill=PALE, font=18)
        line(p, x, 178, x, 1060, colour=GREY, dashed=True)
    flow = [
        (160, 560, 235, "GET /chat/messages or WS bootstrap"),
        (560, 980, 305, "active session user ID"),
        (980, 1430, 375, "ensure WORKPLACE participant"),
        (980, 1430, 445, "load only participant conversations"),
        (1430, 980, 515, "messages + per-conversation unread count"),
        (980, 560, 585, "conversation list + first unread ID"),
        (560, 160, 655, "render unread marker; scroll to first unread"),
        (160, 560, 735, "open/read/send action"),
        (560, 980, 805, "validate message and conversation membership"),
        (980, 1430, 875, "insert message or upsert read state"),
        (980, 1430, 945, "select participant user IDs"),
        (980, 560, 1015, "broadcast only to those sockets"),
        (560, 160, 1080, "append message / update unread badge")
    ]
    for start, end, y, label in flow:
        arrow(p, start, y, end, y, label, dashed=end < start)
    p.append(f'<rect x="1130" y="185" width="600" height="145" rx="12" fill="#F7E6E4" stroke="{RED}" stroke-width="3"/>')
    p.append(text(["Denied paths", "No active session or cross-origin WebSocket -> reject upgrade", "Not a DIRECT participant -> no load, send, read update or broadcast", "Self/inactive direct target -> 400; message outside 1..1000 chars -> 400"], 1160, 220, size=18, line_height=31, weight=600))
    p.append(text("Read state key: (user_id, conversation_id). The stored last_read_message_id is only advanced when that message belongs to a conversation containing the current user.", 900, 1125, size=18, colour=GREY, anchor="middle"))
    save("06_nodychat_unread_flow.svg", p)


if __name__ == "__main__":
    use_case()
    erd()
    architecture()
    assignment_sequence()
    swap_state()
    chat_flow()
    print(f"Generated six SVG diagrams in {OUTPUT}")
