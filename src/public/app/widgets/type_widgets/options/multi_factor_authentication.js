import server from "../../../services/server.js";
import protectedSessionHolder from "../../../services/protected_session_holder.js";
import toastService from "../../../services/toast.js";
import OptionsWidget from "./options_widget.js";
// import { randomBytes } from "crypto";

// import { generateSecret } from "../../../services/totp.js";

// const speakeasy = require("speakeasy");
// ${speakeasy.generateSecret().base32}

const TPL = `
<div class="options-section">
    <h4 class="mfa-heading"></h4>
    
    <div class="alert alert-warning" role="alert" style="font-weight: bold; color: red !important;">
      Use TOTP (Time-based One-Time Password) to safeguard your data in this application because it adds an additional layer of security by generating unique passcodes that expire quickly, making it harder for unauthorized access. TOTP also reduces the risk of account compromise through common threats like phishing attacks or password breaches.
    </div>
    
  <br>
  <h4>TOTP Settings</h4>
    <div>
      <label>
          Enable TOTP
      </label>
      <input type="checkbox" class="totp-enabled" />
    </div>

<br>
    <div class="options-section">
      <label>
      TOTP Secret
      </label>
      <input class="totp-secret-input form-control" disabled="true" type="text">
      <button class="save-totp" disabled="true"> Save TOTP Secret </button>
    </div>

    <br>
 <h4> Generate TOTP Secret </h4>
    <span class="totp-secret" >  </span>
    <br>
    <button class="regenerate-totp"> Regenerate TOTP Secret </button>
</div>`;

export default class MultiFactorAuthenticationOptions extends OptionsWidget {
  doRender() {
    this.$widget = $(TPL);

    this.$mfaHeadding = this.$widget.find(".mfa-heading");
    this.$regenerateTotpButton = this.$widget.find(".regenerate-totp");
    this.$totpEnabled = this.$widget.find(".totp-enabled");
    this.$totpSecret = this.$widget.find(".totp-secret");
    this.$totpSecretInput = this.$widget.find(".totp-secret-input");
    this.$saveTotpButton = this.$widget.find(".save-totp");

    this.$mfaHeadding.text("Multi-Factor Authentication");
    this.generateKey();

    // var gen = require("speakeasy");
    // toastService.showMessage("***REMOVED***");

    this.$totpEnabled.on("change", async () => {
      this.updateCheckboxOption("totpEnabled", this.$totpEnabled);
    });

    this.$regenerateTotpButton.on("click", async () => {
      this.generateKey();
    });

    this.$protectedSessionTimeout = this.$widget.find(
      ".protected-session-timeout-in-seconds"
    );
    this.$protectedSessionTimeout.on("change", () =>
      this.updateOption(
        "protectedSessionTimeout",
        this.$protectedSessionTimeout.val()
      )
    );
  }

  async generateKey() {
    server.get("totp/generate").then((result) => {
      if (result.success) {
        this.$totpSecret.text(result.message);
      } else {
        toastService.showError(result.message);
      }
    });
  }

  // async toggleTOTP() {
  //   if (this.$totpEnabled)
  //     server.post("totp/enable").then((result) => {
  //       if (!result.success) toastService.showError(result.message);
  //     });
  //   else
  //     server.post("totp/disable").then((result) => {
  //       if (!result.success) toastService.showError(result.message);
  //     });
  // }

  optionsLoaded(options) {
    // I need to make sure that this is actually pinging the server and that this information is being pulled
    // because it is telling me "totpEnabled is not allowed to be changed" in a toast every time I check the box
    server.get("totp/enabled").then((result) => {
      if (result.success) {
        console.log("Result message: " + typeof result.message);
        console.log("Result message: " + result.message);
        this.setCheckboxState(this.$totpEnabled, result.message);

        console.log("TOTP Status: " + typeof result.message);

        if (result.message) {
          this.$totpSecretInput.prop("disabled", false);
          this.$saveTotpButton.prop("disabled", false);
        } else {
          this.$totpSecretInput.prop("disabled", true);
          this.$saveTotpButton.prop("disabled", true);
        }
      } else {
        toastService.showError(result.message);
      }
    });

    this.$protectedSessionTimeout.val(options.protectedSessionTimeout);
  }

  save() {
    const oldPassword = this.$oldPassword.val();
    const newPassword1 = this.$newPassword1.val();
    const newPassword2 = this.$newPassword2.val();

    this.$oldPassword.val("");
    this.$newPassword1.val("");
    this.$newPassword2.val("");

    if (newPassword1 !== newPassword2) {
      toastService.showError("New passwords are not the same.");
      return false;
    }

    server
      .post("password/change", {
        current_password: oldPassword,
        new_password: newPassword1,
      })
      .then((result) => {
        if (result.success) {
          toastService.showError(
            "Password has been changed. Trilium will be reloaded after you press OK."
          );

          // password changed so current protected session is invalid and needs to be cleared
          protectedSessionHolder.resetProtectedSession();
        } else {
          toastService.showError(result.message);
        }
      });

    return false;
  }
}
