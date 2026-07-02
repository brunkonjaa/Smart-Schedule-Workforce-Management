window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.layout = (function createLayout() {
  function renderMetrics(metrics) {
    return `
      <div class="metric-row">
        ${metrics
          .map(
            (metric) => `
              <article class="metric-pill metric-pill--${metric.tone}">
                <span>${metric.label}</span>
                <strong>${metric.value}</strong>
              </article>
            `
          )
          .join('')}
      </div>
    `;
  }

  function renderButton(button) {
    const toneClass = button.tone ? ` button-${button.tone}` : '';
    const targetPageAttribute = button.targetPage
      ? ` data-target-page="${button.targetPage}"`
      : '';
    return `<button class="action-button${toneClass}" type="button"${targetPageAttribute}>${button.label}</button>`;
  }

  function renderToolbarControl(control) {
    if (control.type === 'button') {
      return `<div class="toolbar-control toolbar-control--button">${renderButton(control)}</div>`;
    }

    if (control.type === 'select') {
      return `
        <label class="toolbar-control">
          <span>${control.label}</span>
          <select class="input-control">
            ${control.options
              .map(
                (option) =>
                  `<option${option === control.value ? ' selected' : ''}>${option}</option>`
              )
              .join('')}
          </select>
        </label>
      `;
    }

    return `
      <label class="toolbar-control">
        <span>${control.label}</span>
        <input class="input-control" type="${control.type}" value="${control.value}" />
      </label>
    `;
  }

  function renderToolbar(block) {
    return `
      <section class="content-panel content-panel--toolbar content-panel--span-16">
        <div class="toolbar-row">
          ${block.title ? `<div class="toolbar-title"><h3>${block.title}</h3></div>` : ''}
          <div class="toolbar-controls">
            ${block.controls.map((control) => renderToolbarControl(control)).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderCell(cell) {
    if (typeof cell === 'string') {
      return cell;
    }

    if (cell.tag) {
      return `<span class="status-tag status-tag--${cell.tag}">${cell.text}</span>`;
    }

    if (cell.subtle) {
      return `<span class="cell-subtle">${cell.text}</span>`;
    }

    return cell.text;
  }

  function renderTable(block) {
    return `
      <section class="content-panel content-panel--table ${block.spanClass}">
        <div class="panel-heading">
          <h3>${block.title}</h3>
          ${block.caption ? `<p class="panel-copy">${block.caption}</p>` : ''}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${block.columns.map((column) => `<th>${column}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${block.rows
                .map(
                  (row) => `
                    <tr>${row.map((cell, index) => `<td data-label="${block.columns[index]}">${renderCell(cell)}</td>`).join('')}</tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderListBlock(block) {
    return `
      <section class="content-panel content-panel--list ${block.spanClass}">
        <div class="panel-heading">
          <h3>${block.title}</h3>
          ${block.caption ? `<p class="panel-copy">${block.caption}</p>` : ''}
        </div>
        <ul class="detail-list">
          ${block.items.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function renderField(field) {
    const label = `<span>${field.label}</span>`;
    const fieldClass = `form-field ${field.spanClass || 'form-field--span-6'}`;

    if (field.type === 'select') {
      return `
        <label class="${fieldClass}">
          ${label}
          <select class="input-control">
            ${field.options
              .map(
                (option) =>
                  `<option${option === field.value ? ' selected' : ''}>${option}</option>`
              )
              .join('')}
          </select>
        </label>
      `;
    }

    if (field.type === 'textarea') {
      return `
        <label class="${fieldClass}">
          ${label}
          <textarea class="input-control input-control--textarea" rows="${field.rows || 4}" placeholder="${field.placeholder || ''}">${field.value || ''}</textarea>
        </label>
      `;
    }

    return `
      <label class="${fieldClass}">
        ${label}
        <input class="input-control" type="${field.type}" value="${field.value || ''}" placeholder="${field.placeholder || ''}"${field.readonly ? ' readonly' : ''} />
      </label>
    `;
  }

  function renderForm(block) {
    return `
      <section class="content-panel content-panel--form ${block.spanClass}">
        <div class="panel-heading">
          <h3>${block.title}</h3>
          ${block.caption ? `<p class="panel-copy">${block.caption}</p>` : ''}
        </div>
        <form class="form-shell" action="#">
          <div class="form-grid">
            ${block.fields.map((field) => renderField(field)).join('')}
          </div>
          ${
            block.actions
              ? `<div class="actions-row">${block.actions.map((button) => renderButton(button)).join('')}</div>`
              : ''
          }
        </form>
      </section>
    `;
  }

  function renderEmptyState(block) {
    return `
      <section class="content-panel content-panel--empty ${block.spanClass}">
        <div class="empty-state">
          <h3>${block.title}</h3>
          <p>${block.body}</p>
          ${block.action ? renderButton(block.action) : ''}
        </div>
      </section>
    `;
  }

  function renderNote(block) {
    return `
      <section class="content-panel content-panel--note ${block.spanClass}">
        <div class="panel-heading">
          <h3>${block.title}</h3>
        </div>
        <p class="panel-copy">${block.body}</p>
      </section>
    `;
  }

  function renderBlock(block) {
    switch (block.type) {
      case 'toolbar':
        return renderToolbar(block);
      case 'table':
        return renderTable(block);
      case 'form':
        return renderForm(block);
      case 'list':
        return renderListBlock(block);
      case 'empty':
        return renderEmptyState(block);
      case 'note':
      default:
        return renderNote(block);
    }
  }

  function renderWorkspace(page) {
    return `
      ${renderMetrics(page.metrics)}
      <div class="workspace-grid">
        ${page.blocks.map((block) => renderBlock(block)).join('')}
      </div>
    `;
  }

  function renderPageIntro(page, role) {
    const roleLabel =
      role === 'manager' ? 'Manager' : role === 'staff' ? 'Staff' : '';
    const compactClass = page.compactIntro ? ' page-intro--compact' : '';
    const introMeta = roleLabel
      ? `
      <div class="intro-meta">
        <span class="intro-badge">${roleLabel}</span>
        <p>${page.context}</p>
      </div>
    `
      : '';

    return `
      <div class="intro-copy${compactClass}">
        <p class="intro-kicker">${page.eyebrow}</p>
        <h2>${page.title}</h2>
        <p class="intro-summary">${page.summary}</p>
      </div>
      ${introMeta}
    `;
  }

  return {
    renderWorkspace,
    renderPageIntro
  };
})();
