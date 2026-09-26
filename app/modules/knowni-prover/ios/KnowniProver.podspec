# KnowniProver.podspec: the iOS side of the prover module. Vendors the
# xcframework prover/tools/build-ios.sh builds; its header declares the C calls
# the Swift module makes.
require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'KnowniProver'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/LuisAlejandroCR/knowni.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,swift}"
  # Vendored only when build-ios.sh has run (macOS). Without it the Swift side
  # compiles its `unsupported` branch instead of failing the whole app build.
  if File.exist?(File.join(__dir__, 'KnowniProver.xcframework'))
    s.vendored_frameworks = 'KnowniProver.xcframework'
  end
end
