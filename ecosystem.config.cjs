module.exports = {
  apps: [
    {
      name: "kantine",
      cwd: __dirname,
      script: "npm",
      args: "run dev",
      interpreter: "bash",
      watch: false
    }
  ]
}
