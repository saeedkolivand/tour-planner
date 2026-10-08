Pod::Spec.new do |s|
  s.name           = 'ScannerOcr'
  s.version        = '1.0.0'
  s.summary        = 'Apple Vision text recognition with line positions'
  s.description    = 'Apple Vision text recognition with line positions, for the scanner list'
  s.author         = ''
  s.homepage       = 'https://github.com/saeedkolivand/tour-planner'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
