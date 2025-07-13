function generateOTP() {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendOTP(mobileNumber, otp) {
  // In a real application, this would integrate with an SMS service
  // For this assignment, we'll just log the OTP
  console.log(`OTP for ${mobileNumber}: ${otp}`)

  // Simulate SMS sending delay
  await new Promise((resolve) => setTimeout(resolve, 100))

  return true
}

module.exports = {
  generateOTP,
  sendOTP,
}
