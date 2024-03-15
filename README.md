
# Chase Bliss Firmware Interface Program

This web-based firmware programmer allows users to update and manage firmware on Chase Bliss Audio devices, offering compatibility with various DFU (Device Firmware Update)-capable chips and boards. 
## Usage

The firmware programmer enables users to flash their devices with either user-uploaded binary files or select from a range of pre-compiled firmware options.

To access the programmer, visit:

[https://firmware.chasebliss.com](https://firmware.chasebliss.com)

Please follow the instructions provided on the webpage to update your device.

## Local Testing and Development

For local development or testing within your network, follow these steps to set up the programmer:

### Requirements

- Ensure Node.js is installed on your computer. Download it from [Node.js official website](https://nodejs.org/).

### Setting Up `live-server` for Local Testing

1. **Install `live-server`**:
  - Open your terminal or command prompt.
  - Navigate to the project directory where the programmer is located.
  - Execute the following command to install `live-server` globally, allowing its use across projects:

```bash
npm install -g live-server
```

2. **Run the Interface Locally**:
  - In your terminal, navigate to the root directory of the repository.
  - Start `live-server` with this command:

```bash
live-server 
```

3. **Accessing the Local Version**:
  - With the server running, visit [https://localhost:8080](https://localhost:8080) to use the interface locally.
