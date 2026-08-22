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

function openUploadOrdinanceModal() {
    const form = document.getElementById('uploadOrdinanceForm');
    if (form) form.reset();

    // Record audit log when form is opened
    if (typeof logAuditEvent === 'function') {
        logAuditEvent('OPEN_UPLOAD_ORDINANCE_FORM', 'Opened Upload Ordinance form modal');
    }

    const modalEl = document.getElementById('uploadOrdinanceModal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        } else if (typeof $ !== 'undefined' && $.fn && $.fn.modal) {
            $('#uploadOrdinanceModal').modal('show');
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
}

// Single consolidated DOMContentLoaded event listener for modal action buttons
document.addEventListener('DOMContentLoaded', function() {
    const createBtn = document.getElementById('createNewOfficerBtn');
    if (createBtn) {
        createBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openNewOfficerModal();
        });
    }

    const uploadBtn = document.getElementById('uploadOrdinanceBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openUploadOrdinanceModal();
        });
    }
});
