const form = document.querySelector("#registration-form");
const successMessage = document.querySelector("#success-message");
const successName = document.querySelector("#success-name");
const successNumber = document.querySelector("#success-number");
const formHeader = document.querySelector(".form-header");
const GOOGLE_SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw0LHvuDn4jIUOzq1ZLLyAEQERr67H7atXa5018ZY2Zr6EgO6x8X4edp7pFQX2q_Gkx/exec";
const paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
const cashMessage = document.querySelector("#cash-message");
const onlinePayment = document.querySelector("#online-payment");
const paymentProof = document.querySelector("#payment-proof");
const guidelines = document.querySelector("#trip-guidelines");
const guidelinesAccepted = document.querySelector("#guidelines-accepted");
const submitButton = form?.querySelector(".submit-button");
const copyUpiButtons = document.querySelectorAll(".copy-upi");

async function copyUpiId(button) {
  const upiId = button.dataset.upi;

  if (!upiId) {
    window.alert("UPI ID is not available.");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(upiId);
    } else {
      const copyField = document.createElement("textarea");
      copyField.value = upiId;
      copyField.setAttribute("readonly", "");
      copyField.style.position = "fixed";
      copyField.style.opacity = "0";
      document.body.appendChild(copyField);
      copyField.select();
      const copied = document.execCommand("copy");
      copyField.remove();

      if (!copied) {
        throw new Error("UPI ID could not be copied.");
      }
    }

    const originalText = button.textContent;
    button.textContent = "UPI ID copied";
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "UPI ID could not be copied.");
  }
}

copyUpiButtons.forEach((button) => {
  button.addEventListener("click", () => {
    copyUpiId(button);
  });
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Payment screenshot could not be read."));
    reader.readAsDataURL(file);
  });
}

if (guidelines && guidelinesAccepted && submitButton) {
  const updateSubmitState = () => {
    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
    submitButton.disabled = !guidelines.open || !guidelinesAccepted.checked ||
      !selectedPayment || (selectedPayment.value === "Online" && !paymentProof.files.length);
  };

  guidelines.addEventListener("toggle", () => {
    guidelinesAccepted.disabled = !guidelines.open;

    if (!guidelines.open) {
      guidelinesAccepted.checked = false;
    }

    updateSubmitState();
  });

  guidelinesAccepted.addEventListener("change", () => {
    updateSubmitState();
  });

  paymentMethodInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const isOnline = input.value === "Online" && input.checked;
      onlinePayment.hidden = !isOnline;
      cashMessage.hidden = isOnline || !input.checked;
      paymentProof.required = isOnline;
      updateSubmitState();
    });
  });

  paymentProof.addEventListener("change", updateSubmitState);
}

if (form && successMessage) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!GOOGLE_SHEETS_ENDPOINT) {
      window.alert("Registration is not connected yet. Add the deployed Google Apps Script /exec URL in script.js.");
      return;
    }

    const submitButton = form.querySelector(".submit-button");
    submitButton.disabled = true;
    submitButton.textContent = "Saving registration...";

    try {
      const formData = new FormData(form);
      const proof = formData.get("paymentProof");
      const proofData = proof instanceof File && proof.size
        ? await fileToBase64(proof)
        : "";
      formData.delete("paymentProof");
      formData.set("paymentProofName", proof instanceof File ? proof.name : "");
      formData.set("paymentProofData", proofData);
      formData.set("paymentProofType", proof instanceof File && proof.type ? proof.type : "");
      formData.set("paymentAmount", "400");

      const response = await fetch(GOOGLE_SHEETS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Registration could not be saved.");
      }

      successName.textContent = result.name;
      successNumber.textContent = `Registration #${result.registrationNumber}`;
      formHeader.hidden = true;
      form.hidden = true;
      successMessage.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const message = error instanceof TypeError && error.message === "Failed to fetch"
        ? "The Google Apps Script returned 403 or is not deployed for Anyone access. Redeploy it as a Web app with 'Who has access: Anyone'."
        : error.message;
      window.alert(message);
      submitButton.disabled = false;
      submitButton.textContent = "Complete registration ↗";
    }
  });
}

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

if (menuToggle && navigation) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const welcomeGuide = document.querySelector("#welcome-guide");
const welcomeGuideClose = welcomeGuide?.querySelector(".welcome-guide-close");

if (welcomeGuide && welcomeGuideClose && !localStorage.getItem("nssTrekWelcomeSeen")) {
  welcomeGuide.showModal();

  welcomeGuideClose.addEventListener("click", () => {
    localStorage.setItem("nssTrekWelcomeSeen", "true");
    welcomeGuide.close();
  });

  welcomeGuide.addEventListener("cancel", () => {
    localStorage.setItem("nssTrekWelcomeSeen", "true");
  });
}
