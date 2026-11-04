Pod::Spec.new do |s|
  s.name           = 'PlaceSearch'
  s.version        = '1.0.0'
  s.summary        = 'Apple Maps place search by name'
  s.description    = 'Apple Maps place search (MKLocalSearch) by name'
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
