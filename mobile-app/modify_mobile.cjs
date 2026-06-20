const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add State
content = content.replace(
  "const [editProfileVisible, setEditProfileVisible] = useState(false);",
  "const [editProfileVisible, setEditProfileVisible] = useState(false);\n  const [appReviewVisible, setAppReviewVisible] = useState(false);\n  const [appReviewRating, setAppReviewRating] = useState(5);\n  const [appReviewComment, setAppReviewComment] = useState('');\n  const [submittingAppReview, setSubmittingAppReview] = useState(false);"
);

// 2. Add Submit Function
const submitAppReviewFunc = `
  const handleSubmitAppReview = async () => {
    setSubmittingAppReview(true);
    try {
      await axios.post(\`\${API_URL}/app-reviews\`, { rating: appReviewRating, comment: appReviewComment }, { headers: { Authorization: \`Bearer \${token}\` } });
      Alert.alert("Thank you!", "Your app review has been submitted to the SuperAdmin.");
      setAppReviewVisible(false);
      setAppReviewComment('');
      setAppReviewRating(5);
    } catch (e) {
      Alert.alert("Error", "Failed to submit review.");
    } finally {
      setSubmittingAppReview(false);
    }
  };
`;

content = content.replace(
  "const fetchBags = async () => {",
  submitAppReviewFunc + "\n  const fetchBags = async () => {"
);

// 3. Add Rate App Button in Edit Profile Modal
const rateAppBtn = `
              <TouchableOpacity 
                style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 30 }}
                onPress={() => {
                  setEditProfileVisible(false);
                  setTimeout(() => setAppReviewVisible(true), 500);
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>Rate the App</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#FEE2E2', borderRadius: 30 }}
`;

content = content.replace(
  /<TouchableOpacity\s+style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#FEE2E2', borderRadius: 30 }}\s*onPress={\(\) => {\s*setEditProfileVisible\(false\);\s*logout\(\);\s*}}\s*>/,
  rateAppBtn + '\n                onPress={() => {\n                  setEditProfileVisible(false);\n                  logout();\n                }}\n              >'
);

// 4. Add App Review Modal at the end of DiscoverScreen's returned view
const appReviewModal = `
      {/* App Review Modal */}
      <Modal visible={appReviewVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', padding: 24, paddingBottom: Math.max(insets.bottom, 24), borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Rate Grabengo App</Text>
              <TouchableOpacity onPress={() => setAppReviewVisible(false)}><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setAppReviewRating(star)}>
                  <Ionicons name={star <= appReviewRating ? "star" : "star-outline"} size={40} color="#FBBF24" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What do you think of our app?" multiline value={appReviewComment} onChangeText={setAppReviewComment} />
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleSubmitAppReview} disabled={submittingAppReview}>
              {submittingAppReview ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>Submit Review</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
`;

content = content.replace(
  /<\/View>\n\s*<\/Modal>\n\n\s*<\/View>\n\s*\);\n}/,
  "</View>\n        </Modal>\n\n" + appReviewModal + "\n    </View>\n  );\n}"
);

fs.writeFileSync('App.js', content);
