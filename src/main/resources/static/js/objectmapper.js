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