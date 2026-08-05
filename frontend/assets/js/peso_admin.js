// PESO Admin Portal JavaScript Module - Officers Management & Modal Handlers

function openNewOfficerModal() {
    const form = document.getElementById('newOfficerForm');
    if (form) form.reset();
    
    // Record audit log when form is opened
    if (typeof logAuditEvent === 'function') {
        logAuditEvent('OPEN_CREATE_OFFICER_FORM', 'Opened Create New Officer Account form modal');
    }

    const modalEl = document.getElementById('newOfficerModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        } else if (typeof $ !== 'undefined' && $.fn && $.fn.modal) {
            $('#newOfficerModal').modal('show');
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const createBtn = document.getElementById('createNewOfficerBtn');
    if (createBtn) {
        createBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openNewOfficerModal();
        });
    }
});
