<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BeanToBin - Environmental Monitoring System</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- TailwindCSS CDN -->
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.3/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-br from-gray-100 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
  <!-- Header Navigation -->
  <header class="bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <div class="flex items-center">
          <div class="bg-cyan-500 rounded-full p-2 mr-3">
            <!-- Example SVG icon for Leaf -->
            <svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M5 21c0-4.418 7-10 7-10s7 5.582 7 10a7 7 0 01-14 0z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Bean<span class="text-cyan-500">To</span>Bin
            </h1>
            <p class="text-sm text-gray-600 dark:text-gray-300">Environmental Monitoring System</p>
          </div>
        </div>
        <div class="flex items-center space-x-6">
          <a href="/dashboard.php" class="text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
            Dashboard
          </a>
          <a href="/contact.php" class="text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
            Contact
          </a>
          <!-- Dark mode toggle can be implemented with JS or Alpine.js -->
        </div>
      </div>
    </nav>
  </header>

  <!-- Main Content -->
  <main class="max-w-4xl mx-auto py-16 px-4 text-center">
    <h2 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">Welcome to BeanToBin</h2>
    <p class="text-lg text-gray-700 dark:text-gray-300 mb-8">
      Real-time environmental monitoring for temperature, humidity, and soil moisture. Stay informed, stay sustainable.
    </p>
    <a href="/dashboard.php" class="inline-block bg-cyan-500 text-white font-bold py-3 px-8 rounded shadow hover:bg-cyan-400 transition">
      Go to Dashboard
    </a>
  </main>

  <!-- Footer -->
  <footer class="text-center py-6 text-gray-500 text-sm">
    &copy; <?= date('Y') ?> BeanToBin &mdash; Environmental Monitoring System
  </footer>
</body>
</html>
