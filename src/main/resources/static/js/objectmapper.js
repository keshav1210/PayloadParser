function updatePlaceholder() {
        const lang = document.getElementById('inputLang').value;
        const editor = document.getElementById('inputEditor');

        const placeholders = {
            java: 'public class Person {\n    private String name;\n    private int age;\n}',
            python: 'class Person:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age',
            javascript: 'class Person {\n    constructor(name, age) {\n        this.name = name;\n        this.age = age;\n    }\n}',
             json: '{\n    "name": "John",\n    "age": 30,\n    "address": {\n        "city": "New York",\n        "zipCode": "10001"\n    }\n}',
        };

        editor.placeholder = placeholders[lang] || 'Type or paste your code here...';

        const outputLang = document.getElementById('outputLang').value;
                 const inputLang = document.getElementById('inputLang').value;
                           if (outputLang !== 'json' && inputLang!=='json') {
                               document.getElementById('object').hidden = false;
                                document.getElementById('camelcase').style.display='none';
                                document.getElementById('snakecase').style.display='none';
                                document.getElementById('outputFormat').value='class';
                           }else{
                           if(document.getElementById('outputFormat').value==='class'){
                           document.getElementById('outputFormat').value='CamelCase';
                           }
                           document.getElementById('object').hidden = true;
                                           document.getElementById('camelcase').style.display='block';
                                           document.getElementById('snakecase').style.display='block';
                           }
                            updateJavaOptionsVisibility();
    }



    function updateOutputPlaceholder() {

        const outputEditor = document.getElementById('outputEditor');
        outputEditor.placeholder = 'Converted code will appear here...';
         const outputLang = document.getElementById('outputLang').value;
         const inputLang = document.getElementById('inputLang').value;
                   if (outputLang !== 'json' && inputLang!=='json') {
                       document.getElementById('object').hidden = false;
                        document.getElementById('camelcase').style.display='none';
                        document.getElementById('snakecase').style.display='none';
                        document.getElementById('outputFormat').value='class';
                   }else{
                   if(document.getElementById('outputFormat').value==='class'){
                   document.getElementById('outputFormat').value='CamelCase';
                   }
                   document.getElementById('object').hidden = true;
                                   document.getElementById('camelcase').style.display='block';
                                   document.getElementById('snakecase').style.display='block';
                   }
                   updateJavaOptionsVisibility();
    }

    function formatInput() {
        const input = document.getElementById('inputEditor').value;
        if (!input.trim()) {
            updateStatus('No code to format');
            return;
        }
        updateStatus('Code formatted');
    }

    function copyOutput() {
        const output = document.getElementById('outputEditor');
        if (!output.value.trim()) {
            updateStatus('No output to copy');
            return;
        }
        output.select();
        document.execCommand('copy');
        updateStatus('Output copied to clipboard!');
    }

    function clearAll() {
        document.getElementById('inputEditor').value = '';
        document.getElementById('outputEditor').value = '';
        updateStatus('All cleared');
    }

    function loadSample() {
        const inputLang = document.getElementById('inputLang').value;
        const inputEditor = document.getElementById('inputEditor');

        const samples = {
         json: `{"id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "age": 30,
    "address": {
       "city": "New York",
       "state": "NY",
        "zipCode": "10001"
         },
    "tags": ["developer", "tech"],
    "active": true
}`,
            java: `public class UserDTO {
    private int id;
    private String name;
    private AddressDTO address;

    // Getters and setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public AddressDTO getAddress() { return address; }
    public void setAddress(AddressDTO address) { this.address = address; }
}

public class AddressDTO {
    private String city;
    private String state;
    private String zipCode;

    // Getters and setters
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getZipCode() { return zipCode; }
    public void setZipCode(String zipCode) { this.zipCode = zipCode; }
}`,
            python: `class User:
    def __init__(self, username, email, age, address):
        self.username = username
        self.email = email
        self.age = age
        self.address = address  # Address object

    def get_info(self):
        return f"{self.username} ({self.email})"

class Address:
    def __init__(self, city, state, zip_code):
        self.city = city
        self.state = state
        self.zip_code = zip_code

    def get_full_address(self):
        return f"{self.city}, {self.state} {self.zip_code}"`,
            javascript: `class User {
    constructor(username, email, age, address) {
        this.username = username;
        this.email = email;
        this.age = age;
        this.address = address;  // Address object
    }

    getInfo() {
        return \`\${this.username} (\${this.email})\`;
    }
}

class Address {
    constructor(city, state, zipCode) {
        this.city = city;
        this.state = state;
        this.zipCode = zipCode;
    }

    getFullAddress() {
        return \`\${this.city}, \${this.state} \${this.zipCode}\`;
    }
}`,
            typescript: `interface Address {
    city: string;
    state: string;
    zipCode: string;
}

interface User {
    id: number;
    username: string;
    email: string;
    address: Address;
}

class UserImpl implements User {
    constructor(
        public id: number,
        public username: string,
        public email: string,
        public address: Address
    ) {}
}`,
            csharp: `public class User
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string Email { get; set; }
    public Address Address { get; set; }
}

public class Address
{
    public string City { get; set; }
    public string State { get; set; }
    public string ZipCode { get; set; }
}`

        };



        inputEditor.value = samples[inputLang] || samples.java;
        updateStatus('Sample code loaded with nested types');
    }

    // Configure your backend URL here


   /* async function convertCode() {
        const inputCode = document.getElementById('inputEditor').value;
        const inputLang = document.getElementById('inputLang').value;
        const outputLang = document.getElementById('outputLang').value;
        const outputFormat = document.getElementById('outputFormat').value;
        const outputEditor = document.getElementById('outputEditor');

        if (!inputCode.trim()) {
            updateStatus('Please enter code to convert');
            return;
        }

        updateStatus('Converting...');
        outputEditor.value = '// Converting...';

        try {
            const response = await fetch(`/data/object-to-json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputCode: inputCode,
                    inputLang: inputLang,
                    outputLang: outputLang,
                    outputFormat: outputFormat
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.convertedCode) {
                outputEditor.value = data.convertedCode;
                updateStatus('Conversion complete! All nested types converted.');
            } else if (data.error) {
                outputEditor.value = `// Error: ${data.error}`;
                updateStatus('Conversion failed: ' + data.error);
            } else {
                outputEditor.value = '// Conversion failed';
                updateStatus('Conversion failed');
            }
        } catch (error) {
            outputEditor.value = `// Error: ${error.message}\n// Make sure your backend server is running at ${BACKEND_URL}`;
            updateStatus('Error: Cannot connect to backend server');
            console.error('Conversion error:', error);
        }
    }*/


    async function convertCode() {
        const inputCode = document.getElementById('inputEditor').value;
        const inputLang = document.getElementById('inputLang').value;
        const outputLang = document.getElementById('outputLang').value;
        const outputFormat = document.getElementById('outputFormat').value;
        const outputEditor = document.getElementById('outputEditor');

        // Get Java-specific options
        const javaOptions = document.getElementById('javaOptions') ? document.getElementById('javaOptions').value : 'standard';
        const constructorOptions = document.getElementById('constructorOptions') ? document.getElementById('constructorOptions').value : 'noargs';

        if (!inputCode.trim()) {
            updateStatus('Please enter code to convert');
            return;
        }

        updateStatus('Converting...');
        outputEditor.value = '// Converting...';

        try {
            const response = await fetch(`/data/object-to-json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputCode: inputCode,
                    inputLang: inputLang,
                    outputLang: outputLang,
                    outputFormat: outputFormat,
                    javaOptions: javaOptions,
                    constructorOptions: constructorOptions
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.convertedCode) {
                outputEditor.value = data.convertedCode;
                updateStatus('Conversion complete! All nested types converted.');
            } else if (data.error) {
                outputEditor.value = `// Error: ${data.error}`;
                updateStatus('Conversion failed: ' + data.error);
            } else {
                outputEditor.value = '// Conversion failed';
                updateStatus('Conversion failed');
            }
        } catch (error) {
            outputEditor.value = `// Error: ${error.message}`;
            updateStatus('Error: Cannot connect to backend server');
            console.error('Conversion error:', error);
        }
    }

    function updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    function updateJavaOptionsVisibility() {
        const inputLang = document.getElementById('inputLang').value;
        const outputLang = document.getElementById('outputLang').value;

        const javaOptionsGroup = document.getElementById('javaOptionsGroup');
        const constructorOptionsGroup = document.getElementById('constructorOptionsGroup');

        if (inputLang === 'json' && outputLang === 'java') {
            javaOptionsGroup.style.display = 'block';
            updateJavaSubOptions();
        } else {
            javaOptionsGroup.style.display = 'none';
            constructorOptionsGroup.style.display = 'none';
        }
    }

    function updateJavaSubOptions() {
        const javaOptions = document.getElementById('javaOptions').value;
        const constructorOptionsGroup = document.getElementById('constructorOptionsGroup');

        if (javaOptions === 'standard') {
            constructorOptionsGroup.style.display = 'block';
        } else {
            constructorOptionsGroup.style.display = 'none';
        }
    }

    // Initialize
    updatePlaceholder();

    const SD_EP = window.location.origin + '/data/share/text';

      let _sdSource = 'input';

     function openShareModal(source) {
        _sdSource = source || 'input';
        // Reset to form state
        document.getElementById('sdForm').style.display    = 'block';
        document.getElementById('sdLoader').classList.remove('show');
        document.getElementById('sdSuccess').style.display = 'none';
        document.getElementById('sdError').style.display   = 'none';
        document.getElementById('sdError').textContent     = '';
        document.getElementById('sdOneTime').checked       = false;
        const emailInput = document.getElementById('sdEmail');
        if (emailInput) emailInput.value = '';
        const emailStatus = document.getElementById('sdEmailStatus');
        if (emailStatus) {
          emailStatus.style.display = 'none';
          emailStatus.textContent = '';
        }
        setSdSource(_sdSource);
        document.getElementById('sdOverlay').classList.add('show');
      }

    function closeSdModal() {
        document.getElementById('sdOverlay').classList.remove('show');
      }

      function setSdSource(src) {
        _sdSource = src;
        document.getElementById('sdSrcInput') .classList.toggle('active', src === 'input');
        document.getElementById('sdSrcOutput').classList.toggle('active', src === 'output');
      }

    function getSdContent() {
        if (_sdSource === 'input') {
          const el = document.getElementById('inputEditor');
          return el ? el.value.trim() : '';
        } else {
          const el = document.getElementById('outputEditor');
          return el ? el.value.trim() : '';
        }
    }

    async function doShare(sendEmail) {
        const text = getSdContent();

        if (!text) {
          const err = document.getElementById('sdError');
          err.textContent = '⚠ Nothing to share — the selected panel is empty.';
          err.style.display = 'block';
          return;
        }

        const emailInput = document.getElementById('sdEmail');
        const email = emailInput ? emailInput.value.trim() : '';

        if (sendEmail && !email) {
          const err = document.getElementById('sdError');
          err.textContent = '⚠ Please enter a recipient email to send on mail.';
          err.style.display = 'block';
          if (emailInput) emailInput.focus();
          return;
        }

        const oneTime = document.getElementById('sdOneTime').checked;

        // Show loader
        document.getElementById('sdForm').style.display    = 'none';
        document.getElementById('sdLoader').classList.add('show');
        document.getElementById('sdError').style.display   = 'none';

        try {
          const payload = {
            text,
            oneTimeDownload: oneTime,
            sourcePage: window.location.pathname
          };
          if (email) {
            payload.email = email;
          }

          const res = await fetch(SD_EP, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
          });

          const json = await res.json();

          if (!res.ok || !json.success) throw new Error(json.message || 'Server error ' + res.status);

          // Show success
          document.getElementById('sdLoader').classList.remove('show');
          document.getElementById('sdSuccess').style.display = 'block';

          const token = json.token || (json.url ? json.url.substring(json.url.lastIndexOf('/') + 1) : '');
          const keyEl = document.getElementById('sdKeyText');
          if (keyEl) keyEl.textContent = token;

          document.getElementById('sdUrlText').textContent = json.url;
          document.getElementById('sdSuccessSub').textContent =
            `${text.length.toLocaleString()} chars · ${_sdSource} panel` + (oneTime ? ' · one-time' : '');

          const statusEl = document.getElementById('sdEmailStatus');
          if (statusEl) {
            if (email) {
              statusEl.style.display = 'block';
              if (json.emailSent) {
                statusEl.style.background = 'rgba(0,200,150,.12)';
                statusEl.style.borderColor = 'rgba(0,200,150,.3)';
                statusEl.style.color = '#00ddb3';
                statusEl.textContent = `✓ Drop sent to ${email}`;
              } else if (json.mailtoUrl) {
                statusEl.style.background = 'rgba(255,170,0,.1)';
                statusEl.style.borderColor = 'rgba(255,170,0,.3)';
                statusEl.style.color = '#ffb84d';
                statusEl.textContent = `✉ Opening email client for ${email}...`;
                window.open(json.mailtoUrl, '_blank');
              } else {
                statusEl.style.display = 'none';
              }
            } else {
              statusEl.style.display = 'none';
            }
          }

        } catch (err) {
          document.getElementById('sdLoader').classList.remove('show');
          document.getElementById('sdForm').style.display  = 'block';
          const errEl = document.getElementById('sdError');
          errEl.textContent    = '⚠ ' + err.message;
          errEl.style.display  = 'block';
        }
      }

      function sdCopyUrl() {
        const url = document.getElementById('sdUrlText').textContent;
        navigator.clipboard.writeText(url).then(() => {
          const btn = document.getElementById('sdCopyBtn');
          btn.textContent = '✓ Copied!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = '⎘ Copy Link'; btn.classList.remove('copied'); }, 2200);
        });
      }

      function sdCopyKey() {
        const keyEl = document.getElementById('sdKeyText');
        const key = keyEl ? keyEl.textContent : '';
        if (!key || key === '-----') return;
        navigator.clipboard.writeText(key).then(() => {
          const btn = document.getElementById('sdCopyKeyBtn');
          if (btn) {
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '⎘ Copy Key'; btn.classList.remove('copied'); }, 2200);
          }
        });
      }

      // ── Auto-load shared drop if ?drop=token is present in URL ──────────────────
      async function checkAndLoadSharedDrop() {
        const urlParams = new URLSearchParams(window.location.search);
        const dropToken = urlParams.get('drop');
        if (!dropToken) return;

        try {
          const res = await fetch('/data/shared/' + encodeURIComponent(dropToken));
          if (!res.ok) {
            showDropToast('⚠ Could not load shared drop (link may be expired or already used).', 'error');
            return;
          }

          const content = await res.text();
          const editor = document.getElementById('inputEditor');
          if (editor) {
            editor.value = content;
            if (typeof convertCode === 'function') {
              try { convertCode(); } catch (e) { console.warn('Auto-convert skipped:', e); }
            }
            showDropToast('✓ Shared content loaded into editor!', 'success');
            // Clean URL query parameter without page reload
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error('Failed to load drop:', err);
          showDropToast('⚠ Error loading drop: ' + err.message, 'error');
        }
      }

      function showDropToast(msg, type) {
        let toast = document.getElementById('sdToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'sdToast';
          toast.style.cssText = `
            position: fixed; top: 20px; right: 24px; z-index: 9999;
            padding: 12px 20px; border-radius: 10px; font-family: 'Outfit', sans-serif;
            font-size: 0.88rem; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: flex; align-items: center; gap: 10px;
          `;
          document.body.appendChild(toast);
        }
        if (type === 'error') {
          toast.style.background = '#251015';
          toast.style.color = '#ff6b81';
          toast.style.border = '1px solid #ff4f6a';
        } else {
          toast.style.background = '#0e2420';
          toast.style.color = '#00ddb3';
          toast.style.border = '1px solid #00c896';
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-10px)';
        }, 4000);
      }

      document.addEventListener('DOMContentLoaded', () => {
        checkAndLoadSharedDrop();
      });

      // Close on backdrop click
      const sdOverlayEl = document.getElementById('sdOverlay');
      if (sdOverlayEl) {
        sdOverlayEl.addEventListener('click', e => {
          if (e.target === sdOverlayEl) closeSdModal();
        });
      }